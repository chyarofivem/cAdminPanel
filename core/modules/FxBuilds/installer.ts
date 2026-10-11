import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import fse from 'fs-extra';
import StreamZip from 'node-stream-zip';
import execa from 'execa';
import got from '@lib/got';
import consoleFactory from '@lib/console';
import { parseBuildNumber } from './state';
import { pathsOverlap, type BuildLayout } from './layout';
const console = consoleFactory('FxBuilds');

/**
 * Disk and network work for the build manager: download, extract, verify, and the copy of
 * the panel's monitor resource into a build.
 *
 * Inside FXServer every awaited disk call waits for a turn of the server's event loop, so
 * work done as hundreds of calls in a row crawls: extracting a build file by file took about
 * 4.5 minutes there and 6 seconds in plain Node. Bulk work here runs in a child process
 * (tar) or issues its calls in parallel.
 */

//A slow link can take a while for ~70 MB; the socket timeout catches a stalled transfer
const DOWNLOAD_TIMEOUT_MS = 30 * 60_000;
const DOWNLOAD_STALL_TIMEOUT_MS = 60_000;

//Buffers what arrives between two loop turns instead of pausing the socket after one chunk
const DOWNLOAD_WRITE_BUFFER = 8 * 1024 * 1024;

//Per-run files the panel writes into its monitor folder (server icon, custom locale)
const MONITOR_RUNTIME_DIR = '.runtime';


export class DownloadCancelledError extends Error {
    constructor() {
        super('Download cancelled.');
    }
}

/**
 * Lets a running job be cancelled from outside, whatever step it is in.
 */
export class JobControl {
    public cancelled = false;
    private abortHandler: (() => void) | null = null;

    public cancel() {
        this.cancelled = true;
        try {
            this.abortHandler?.();
        } catch (error) { }
    }

    public setAbortHandler(handler: (() => void) | null) {
        this.abortHandler = handler;
    }

    public throwIfCancelled() {
        if (this.cancelled) throw new DownloadCancelledError();
    }
}


/**
 * Streams a URL to a file, reporting progress.
 */
export const downloadToFile = async (
    url: string,
    destPath: string,
    job: JobControl,
    onProgress: (receivedBytes: number, totalBytes: number | null) => void,
) => {
    job.throwIfCancelled();
    const gotStream = got.stream(url, {
        timeout: {
            request: DOWNLOAD_TIMEOUT_MS,
            socket: DOWNLOAD_STALL_TIMEOUT_MS,
        },
        retry: { limit: 0 },
    });
    job.setAbortHandler(() => gotStream.destroy(new DownloadCancelledError()));
    gotStream.on('downloadProgress', (progress) => {
        onProgress(progress.transferred, typeof progress.total === 'number' ? progress.total : null);
    });
    try {
        //got and core are typed against different @types/node versions, so the stream
        //types do not line up; at runtime both are plain node streams
        const pipeStreams = pipeline as unknown as (...streams: unknown[]) => Promise<void>;
        await pipeStreams(gotStream, fs.createWriteStream(destPath, { highWaterMark: DOWNLOAD_WRITE_BUFFER }));
    } catch (error) {
        if (job.cancelled) throw new DownloadCancelledError();
        throw error;
    } finally {
        job.setAbortHandler(null);
    }
    job.throwIfCancelled();
};


/**
 * Windows 10 1803 and later ship bsdtar as System32\tar.exe, which reads zip archives.
 * The full path keeps a GNU tar from Git or MSYS on the PATH out: that one cannot read zip
 * and takes `C:` for a remote host.
 */
export const windowsTarPath = () => {
    return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
};

//Missing tar, missing xz (GNU tar), or a tar built without -J (BusyBox)
const missingToolRegex = /ENOENT|not recognized|Cannot exec|xz: not found|invalid option|unrecognized option/i;

const runTar = async (tarPath: string, args: string[], job: JobControl, missingToolHint = '') => {
    const subprocess = execa(tarPath, args, { windowsHide: true });
    job.setAbortHandler(() => subprocess.kill());
    try {
        await subprocess;
    } catch (error) {
        if (job.cancelled) throw new DownloadCancelledError();
        const details = String((error as any)?.stderr || (error as any)?.shortMessage || (error as Error).message).trim();
        const hint = missingToolHint && missingToolRegex.test(details) ? ` ${missingToolHint}` : '';
        throw new Error(`tar could not extract the archive: ${details}${hint}`);
    } finally {
        job.setAbortHandler(null);
    }
};

/**
 * Extracts a build archive with tar: `fx.tar.xz` on Linux, `server.zip` on Windows.
 * On Windows a failing tar.exe falls back to node-stream-zip in this process, which works
 * but takes minutes inside FXServer.
 */
export const extractArchive = async (
    archivePath: string,
    destDir: string,
    isWindows: boolean,
    job: JobControl,
    tarPath = isWindows ? windowsTarPath() : 'tar',
) => {
    job.throwIfCancelled();
    await fsp.mkdir(destDir, { recursive: true });
    if (!isWindows) {
        //Node cannot decompress xz, so there is no fallback here
        const hint = 'Linux builds need tar with xz support on the host: install the tar and xz-utils packages (xz on Alpine and Arch).';
        await runTar(tarPath, ['-xJf', archivePath, '-C', destDir], job, hint);
    } else {
        try {
            await runTar(tarPath, ['-xf', archivePath, '-C', destDir], job);
        } catch (error) {
            if (error instanceof DownloadCancelledError || job.cancelled) throw new DownloadCancelledError();
            console.warn(`${(error as Error).message} Extracting it in the panel instead, which is slower.`);
            await fse.emptyDir(destDir);
            //node-stream-zip cannot be interrupted, the cancel is honoured once it returns
            const zip = new StreamZip.async({ file: archivePath });
            try {
                await zip.extract(null, destDir);
            } finally {
                await zip.close().catch(() => { });
            }
        }
    }
    job.throwIfCancelled();
};


const isFile = async (filePath: string) => {
    try {
        return (await fsp.stat(filePath)).isFile();
    } catch (error) {
        return false;
    }
};

const isDirectory = async (dirPath: string) => {
    try {
        return (await fsp.stat(dirPath)).isDirectory();
    } catch (error) {
        return false;
    }
};


/**
 * Returns what is wrong with a build folder, or null when it can be started.
 */
export const findLayoutProblem = async (layout: BuildLayout, isWindows: boolean): Promise<string | null> => {
    if (!await isFile(layout.binPath)) {
        return isWindows ? 'FXServer.exe is missing' : 'the FXServer binary is missing';
    }
    if (layout.loaderPath && !await isFile(layout.loaderPath)) {
        return 'the ld-musl loader is missing';
    }
    if (!await isDirectory(layout.citizenPath)) {
        return 'the citizen folder is missing';
    }
    return null;
};

/**
 * Same check, synchronous and boolean, for listings.
 */
export const isLayoutAvailableSync = (layout: BuildLayout) => {
    try {
        if (!fs.statSync(layout.binPath).isFile()) return false;
        if (layout.loaderPath && !fs.statSync(layout.loaderPath).isFile()) return false;
        return true;
    } catch (error) {
        return false;
    }
};


/**
 * The marker written into each build folder, so a build can be recognized again
 * even when the state file is lost.
 */
export type BuildMarker = {
    build: number;
    installedAt: number;
    sizeBytes: number;
    monitorVersion: string | null;
    monitorStamp: string | null;
};

export const parseMarker = (raw: unknown): BuildMarker | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    const build = parseBuildNumber(obj.build);
    if (build === null) return null;
    return {
        build,
        installedAt: typeof obj.installedAt === 'number' && Number.isFinite(obj.installedAt) ? obj.installedAt : 0,
        sizeBytes: typeof obj.sizeBytes === 'number' && Number.isFinite(obj.sizeBytes) && obj.sizeBytes >= 0 ? obj.sizeBytes : 0,
        monitorVersion: typeof obj.monitorVersion === 'string' ? obj.monitorVersion : null,
        monitorStamp: typeof obj.monitorStamp === 'string' ? obj.monitorStamp : null,
    };
};

export const readMarker = async (markerPath: string) => {
    try {
        return parseMarker(JSON.parse(await fsp.readFile(markerPath, 'utf8')));
    } catch (error) {
        return null;
    }
};

export const readMarkerSync = (markerPath: string) => {
    try {
        return parseMarker(JSON.parse(fs.readFileSync(markerPath, 'utf8')));
    } catch (error) {
        return null;
    }
};

export const writeMarker = async (markerPath: string, marker: BuildMarker) => {
    await fsp.writeFile(markerPath, JSON.stringify(marker, null, 2));
};


type TreeFile = {
    /** Relative to the walked folder, with the platform's separator. */
    relPath: string;
    size: number;
    mtimeMs: number;
};

/**
 * Lists the folders and regular files under a folder, without following links. Every
 * level is read in parallel (see the note at the top of this file). Entries that vanish
 * during the walk are skipped; an unreadable root throws.
 */
export const walkTree = async (rootPath: string, skip: (relPath: string) => boolean = () => false) => {
    const dirs: string[] = [];
    const files: TreeFile[] = [];
    const walk = async (relDir: string, isRoot: boolean): Promise<void> => {
        let entries: fs.Dirent[];
        try {
            entries = await fsp.readdir(path.join(rootPath, relDir), { withFileTypes: true });
        } catch (error) {
            if (isRoot) throw error;
            return;
        }
        await Promise.all(entries.map(async (entry) => {
            const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
            if (skip(relPath)) return;
            if (entry.isDirectory()) {
                dirs.push(relPath);
                return walk(relPath, false);
            }
            if (!entry.isFile()) return;
            try {
                const stat = await fsp.lstat(path.join(rootPath, relPath));
                files.push({ relPath, size: stat.size, mtimeMs: stat.mtimeMs });
            } catch (error) { }
        }));
    };
    await walk('', true);
    return { dirs, files };
};


/**
 * A fingerprint of every file in the panel's monitor resource (path, size and time), so a
 * rebuilt menu, Lua file or core bundle is copied into the build on its next start. The
 * version alone does not change between development builds. The per-run `.runtime` folder
 * is left out, or every start would copy.
 */
export const getMonitorStamp = async (monitorSrcPath: string) => {
    const { files } = await walkTree(monitorSrcPath, (relPath) => relPath === MONITOR_RUNTIME_DIR);
    const lines = files
        .map((file) => `${file.relPath.split(path.sep).join('/')}:${file.size}:${Math.floor(file.mtimeMs)}`)
        .sort();
    const digest = createHash('sha1').update(lines.join('\n')).digest('hex').slice(0, 16);
    return `${files.length}:${digest}`;
};


/**
 * Replaces the build's own monitor resource with a copy of the panel's.
 */
export const copyMonitor = async (monitorSrcPath: string, layout: BuildLayout) => {
    if (pathsOverlap(monitorSrcPath, layout.monitorPath)) {
        throw new Error('the build folder overlaps the panel resource folder');
    }
    if (!await isFile(path.join(monitorSrcPath, 'fxmanifest.lua'))) {
        throw new Error('the panel resource folder has no fxmanifest.lua');
    }
    const { dirs, files } = await walkTree(monitorSrcPath);
    await fse.remove(layout.monitorPath);
    await fsp.mkdir(layout.monitorPath, { recursive: true });
    await Promise.all(dirs.map((dir) => fsp.mkdir(path.join(layout.monitorPath, dir), { recursive: true })));
    await Promise.all(files.map((file) => fsp.copyFile(
        path.join(monitorSrcPath, file.relPath),
        path.join(layout.monitorPath, file.relPath),
    )));
};


/**
 * Total size of the regular files in a folder, without following links.
 */
export const getDirSize = async (dirPath: string): Promise<number> => {
    try {
        const { files } = await walkTree(dirPath);
        return files.reduce((total, file) => total + file.size, 0);
    } catch (error) {
        return 0;
    }
};


/**
 * Names used for in-progress work inside the builds folder.
 */
export const downloadFileName = (build: number) => `${build}.download`;
export const tempDirName = (build: number) => `.tmp-${build}`;
const leftoverRegex = /^(?:[0-9]{1,7}\.download|\.tmp-[0-9]{1,7})$/;

/**
 * Removes archives and extraction folders left behind by an interrupted download.
 * Only called when no download can be running (at boot).
 */
export const removeLeftovers = async (rootPath: string) => {
    let names: string[];
    try {
        names = await fsp.readdir(rootPath);
    } catch (error) {
        return [];
    }
    const removed: string[] = [];
    for (const name of names) {
        if (!leftoverRegex.test(name)) continue;
        try {
            await fse.remove(path.join(rootPath, name));
            removed.push(name);
        } catch (error) { }
    }
    return removed;
};
