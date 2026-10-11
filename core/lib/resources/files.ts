import fsp from 'node:fs/promises';
import path from 'node:path';
import fse from 'fs-extra';
import type { ResourceBackupInfo } from '@shared/resourceManagerTypes';
import { normalizeVersionTag } from './versions';

export const MANIFEST_FILE_NAMES = ['fxmanifest.lua', '__resource.lua'];
export const MAX_BACKUPS_PER_RESOURCE = 5;
export const SWAP_NEW_SUFFIX = '.cadmin-new';
export const SWAP_OLD_SUFFIX = '.cadmin-old';

const resourceNameRegex = /^[A-Za-z0-9_.-]{1,100}$/;
const backupIdRegex = /^(\d{13})_([A-Za-z0-9._-]{1,40})$/;
const partialBackupPrefix = '.partial-';


/**
 * Resource names that can safely become a folder name and a log entry.
 */
export const isValidResourceName = (name: unknown): name is string => {
    return typeof name === 'string' && resourceNameRegex.test(name) && name !== '.' && name !== '..';
};

export const isValidBackupId = (id: unknown): id is string => {
    return typeof id === 'string' && backupIdRegex.test(id);
};


/**
 * MARK: Paths
 */
/**
 * Whether `child` is strictly inside `parent` (never equal to it).
 */
export const isPathInside = (parent: string, child: string) => {
    const relative = path.relative(path.resolve(parent), path.resolve(child));
    if (!relative || path.isAbsolute(relative)) return false;
    return !relative.split(/[\\/]+/).some((segment) => segment === '..');
};

const hasSystemSegment = (input: string) => {
    return input.split(/[\\/]+/).some((segment) => segment.toLowerCase() === 'system_resources');
};

export type ResourceFolderCheck = {
    ok: true;
    folder: string;
} | {
    ok: false;
    reason: 'no_data_path' | 'not_absolute' | 'outside_data' | 'system_resource';
};

/**
 * Checks a raw FXServer resource path without touching the disk:
 * it must be absolute, strictly inside the server data folder and not a system resource.
 */
export const checkResourceFolder = (rawPath: unknown, dataPath: unknown): ResourceFolderCheck => {
    if (typeof dataPath !== 'string' || !dataPath.trim() || !path.isAbsolute(dataPath)) {
        return { ok: false, reason: 'no_data_path' };
    }
    if (typeof rawPath !== 'string' || !rawPath.trim() || !path.isAbsolute(rawPath)) {
        return { ok: false, reason: 'not_absolute' };
    }
    if (hasSystemSegment(rawPath)) return { ok: false, reason: 'system_resource' };
    const folder = path.resolve(rawPath);
    if (!isPathInside(dataPath, folder)) return { ok: false, reason: 'outside_data' };
    return { ok: true, folder };
};

/**
 * Resources that may be replaced from the panel: inside the server data folder,
 * not a system resource and not the monitor itself.
 */
export const isResourceReplaceable = (resource: { name: string; path: string }, dataPath: unknown) => {
    if (resource.name === 'monitor' || !isValidResourceName(resource.name)) return false;
    return checkResourceFolder(resource.path, dataPath).ok;
};

const folderHasManifest = async (folder: string) => {
    for (const fileName of MANIFEST_FILE_NAMES) {
        try {
            const stat = await fsp.lstat(path.join(folder, fileName));
            if (stat.isFile()) return true;
        } catch { /* not this one */ }
    }
    return false;
};

/**
 * Resolves symlinks and repeats the containment check on the real paths.
 * Returns the real folder only when it is a directory holding a resource manifest.
 */
export const resolveRealResourceFolder = async (folder: string, dataPath: string) => {
    let realFolder: string;
    let realRoot: string;
    try {
        [realFolder, realRoot] = await Promise.all([fsp.realpath(folder), fsp.realpath(dataPath)]);
    } catch {
        return;
    }
    if (!isPathInside(realRoot, realFolder) || hasSystemSegment(realFolder)) return;
    try {
        const stat = await fsp.lstat(realFolder);
        if (!stat.isDirectory()) return;
    } catch {
        return;
    }
    if (!await folderHasManifest(realFolder)) return;
    return realFolder;
};


/**
 * MARK: Manifest root
 */
export type ManifestRootResult = {
    ok: true;
    root: string;
} | {
    ok: false;
    reason: 'not_found' | 'ambiguous';
};

const ignoredArchiveFolders = new Set(['__macosx', '.git']);

/**
 * Finds the folder holding fxmanifest.lua (or __resource.lua) in an extracted archive,
 * at most `maxDepth` levels below `baseDir`. The shallowest match wins; when a level holds
 * several, the one named like the resource wins, else the result is ambiguous.
 * Symlinks are never followed.
 */
export const findManifestRoot = async (baseDir: string, resourceName: string, maxDepth = 3): Promise<ManifestRootResult> => {
    let level = [baseDir];
    let visited = 0;
    for (let depth = 0; depth <= maxDepth && level.length; depth++) {
        const matches: string[] = [];
        for (const dir of level) {
            if (await folderHasManifest(dir)) matches.push(dir);
        }
        if (matches.length === 1) return { ok: true, root: matches[0] };
        if (matches.length > 1) {
            const named = matches.filter((dir) => path.basename(dir).toLowerCase() === resourceName.toLowerCase());
            return named.length === 1
                ? { ok: true, root: named[0] }
                : { ok: false, reason: 'ambiguous' };
        }

        const next: string[] = [];
        for (const dir of level) {
            let entries;
            try {
                entries = await fsp.readdir(dir, { withFileTypes: true });
            } catch {
                continue;
            }
            for (const entry of entries) {
                if (!entry.isDirectory() || ignoredArchiveFolders.has(entry.name.toLowerCase())) continue;
                next.push(path.join(dir, entry.name));
                if (++visited > 5000) return { ok: false, reason: 'not_found' };
            }
        }
        level = next;
    }
    return { ok: false, reason: 'not_found' };
};


/**
 * MARK: Backups
 */
export const sanitizeBackupVersion = (version: unknown) => {
    const cleaned = normalizeVersionTag(version)
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^[.-]+/, '')
        .slice(0, 40);
    return cleaned || 'unknown';
};

export const makeBackupId = (createdAt: number, version: unknown) => {
    return `${Math.trunc(createdAt).toString().padStart(13, '0')}_${sanitizeBackupVersion(version)}`;
};

const parseBackupId = (id: string): ResourceBackupInfo | undefined => {
    const match = backupIdRegex.exec(id);
    if (!match) return;
    return { id, createdAt: parseInt(match[1], 10), version: match[2] };
};

/**
 * Lists a resource's backups, newest first. A missing folder means no backups.
 */
export const listBackups = async (backupsRoot: string, resourceName: string): Promise<ResourceBackupInfo[]> => {
    if (!isValidResourceName(resourceName)) return [];
    let entries;
    try {
        entries = await fsp.readdir(path.join(backupsRoot, resourceName), { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => parseBackupId(entry.name))
        .filter((backup): backup is ResourceBackupInfo => Boolean(backup))
        .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
};

/**
 * Lists the backups of every resource that has any, keyed by resource name.
 */
export const listAllBackups = async (backupsRoot: string) => {
    const result = new Map<string, ResourceBackupInfo[]>();
    let entries;
    try {
        entries = await fsp.readdir(backupsRoot, { withFileTypes: true });
    } catch {
        return result;
    }
    for (const entry of entries) {
        if (!entry.isDirectory() || !isValidResourceName(entry.name)) continue;
        const backups = await listBackups(backupsRoot, entry.name);
        if (backups.length) result.set(entry.name, backups);
    }
    return result;
};

/**
 * Copies a resource folder into `<backupsRoot>/<resource>/<timestamp>_<version>/`.
 * The copy lands under a hidden name first, so a half-written backup is never listed.
 */
export const createBackup = async (
    backupsRoot: string,
    resourceName: string,
    sourceFolder: string,
    version: unknown,
    now = Date.now(),
) => {
    if (!isValidResourceName(resourceName)) throw new Error('invalid resource name');
    const resourceDir = path.join(backupsRoot, resourceName);
    await fsp.mkdir(resourceDir, { recursive: true });

    let createdAt = now;
    let id = makeBackupId(createdAt, version);
    while (await fse.pathExists(path.join(resourceDir, id))) {
        createdAt++;
        id = makeBackupId(createdAt, version);
    }
    const partialPath = path.join(resourceDir, `${partialBackupPrefix}${id}`);
    try {
        await fse.remove(partialPath);
        await fse.copy(sourceFolder, partialPath, { errorOnExist: true, overwrite: false });
        await fsp.rename(partialPath, path.join(resourceDir, id));
    } catch (error) {
        await fse.remove(partialPath).catch(() => { });
        throw error;
    }
    return id;
};

/**
 * Deletes all but the newest `keep` backups of a resource. Returns the removed ids.
 */
export const pruneBackups = async (backupsRoot: string, resourceName: string, keep = MAX_BACKUPS_PER_RESOURCE) => {
    const backups = await listBackups(backupsRoot, resourceName);
    const removed: string[] = [];
    for (const backup of backups.slice(Math.max(0, keep))) {
        await fse.remove(path.join(backupsRoot, resourceName, backup.id));
        removed.push(backup.id);
    }
    return removed;
};


/**
 * MARK: Folder swap
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const retryableRenameCodes = new Set(['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY']);

//Windows briefly locks folders that an antivirus or indexer is reading
const renameWithRetry = async (from: string, to: string, attempts = 5) => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fsp.rename(from, to);
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code ?? '';
            if (attempt >= attempts || !retryableRenameCodes.has(code)) throw error;
            await wait(150 * attempt);
        }
    }
};

export class FolderSwapError extends Error {
    constructor(
        message: string,
        /** The original folder is back in place, untouched. */
        public readonly restored: boolean,
    ) {
        super(message);
        this.name = 'FolderSwapError';
    }
}

export type FolderSwapResult = {
    /** The previous folder could not be deleted and was left at this path. */
    leftoverPath?: string;
};

/**
 * Replaces `target` with a copy of `source`:
 * copy to a sibling `<name>.cadmin-new`, rename the current folder to `<name>.cadmin-old`,
 * rename the new one into place, then delete the old one.
 * Any failure before the last step puts the original folder back.
 */
export const replaceFolder = async (target: string, source: string): Promise<FolderSwapResult> => {
    const newPath = `${target}${SWAP_NEW_SUFFIX}`;
    const oldPath = `${target}${SWAP_OLD_SUFFIX}`;

    const targetStat = await fsp.lstat(target).catch(() => undefined);
    if (!targetStat?.isDirectory()) throw new FolderSwapError('The resource folder does not exist.', true);

    //Leftovers from an interrupted swap; the live folder exists, so neither holds the only copy
    try {
        await fse.remove(newPath);
        await fse.remove(oldPath);
        await fse.copy(source, newPath, { errorOnExist: true, overwrite: false });
    } catch (error) {
        await fse.remove(newPath).catch(() => { });
        throw new FolderSwapError(`Could not stage the new files: ${(error as Error).message}`, true);
    }

    try {
        await renameWithRetry(target, oldPath);
    } catch (error) {
        await fse.remove(newPath).catch(() => { });
        throw new FolderSwapError(`Could not move the current folder: ${(error as Error).message}`, true);
    }

    try {
        await renameWithRetry(newPath, target);
    } catch (error) {
        const message = (error as Error).message;
        try {
            await renameWithRetry(oldPath, target);
        } catch (restoreError) {
            throw new FolderSwapError(
                `Could not move the new folder (${message}) nor restore the old one from ${oldPath}: ${(restoreError as Error).message}`,
                false,
            );
        }
        await fse.remove(newPath).catch(() => { });
        throw new FolderSwapError(`Could not move the new folder into place: ${message}`, true);
    }

    try {
        await fse.remove(oldPath);
        return {};
    } catch {
        return { leftoverPath: oldPath };
    }
};
