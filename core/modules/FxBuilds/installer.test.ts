import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import execa from 'execa';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@core/globalData', () => ({ txEnv: {}, txHostConfig: {} }));
vi.mock('@lib/got', () => ({ default: { stream: vi.fn() } }));

import {
    DownloadCancelledError,
    JobControl,
    copyMonitor,
    extractArchive,
    getDirSize,
    getMonitorStamp,
    walkTree,
    windowsTarPath,
} from './installer';
import { getBuildLayout } from './layout';

let tmpRoot: string;

const writeFile = (relPath: string, data: string) => {
    const filePath = path.join(tmpRoot, ...relPath.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data);
    return filePath;
};

const makeMonitor = () => {
    writeFile('monitor/fxmanifest.lua', 'fx_version "cerulean"');
    writeFile('monitor/entrypoint.js', 'entry');
    writeFile('monitor/core/index.js', 'core bundle');
    writeFile('monitor/nui/index.js', 'menu v1');
    writeFile('monitor/resource/menu/client/cl_base.lua', 'lua');
    fs.mkdirSync(path.join(tmpRoot, 'monitor', 'empty'), { recursive: true });
    return path.join(tmpRoot, 'monitor');
};

beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cadmin-installer-'));
});

afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});


describe('walkTree', () => {
    it('lists nested folders and files, and honours the skip callback', async () => {
        const monitor = makeMonitor();
        writeFile('monitor/.runtime/icon.png', 'icon');
        const { dirs, files } = await walkTree(monitor, (relPath) => relPath === '.runtime');
        const fileNames = files.map((file) => file.relPath.split(path.sep).join('/')).sort();
        expect(fileNames).toEqual([
            'core/index.js',
            'entrypoint.js',
            'fxmanifest.lua',
            'nui/index.js',
            'resource/menu/client/cl_base.lua',
        ]);
        expect(dirs.map((dir) => dir.split(path.sep).join('/'))).toContain('empty');
        expect(files.find((file) => file.relPath === 'entrypoint.js')?.size).toBe(5);
    });

    it('throws when the root cannot be read', async () => {
        await expect(walkTree(path.join(tmpRoot, 'missing'))).rejects.toThrow();
    });
});


describe('getMonitorStamp', () => {
    it('changes when the menu is rebuilt, even at the same size', async () => {
        const monitor = makeMonitor();
        const before = await getMonitorStamp(monitor);
        const menuPath = writeFile('monitor/nui/index.js', 'menu v2');
        const later = new Date(Date.now() + 60_000);
        fs.utimesSync(menuPath, later, later);
        expect(await getMonitorStamp(monitor)).not.toBe(before);
    });

    it('changes when a file is added', async () => {
        const monitor = makeMonitor();
        const before = await getMonitorStamp(monitor);
        writeFile('monitor/resource/new.lua', 'x');
        expect(await getMonitorStamp(monitor)).not.toBe(before);
    });

    it('ignores the per-run .runtime folder', async () => {
        const monitor = makeMonitor();
        const before = await getMonitorStamp(monitor);
        writeFile('monitor/.runtime/icon-abc.png', 'icon');
        expect(await getMonitorStamp(monitor)).toBe(before);
    });
});


describe('copyMonitor', () => {
    it('replaces the build copy with the whole panel resource', async () => {
        const monitor = makeMonitor();
        const layout = getBuildLayout(path.join(tmpRoot, 'build'), true);
        fs.mkdirSync(layout.monitorPath, { recursive: true });
        fs.writeFileSync(path.join(layout.monitorPath, 'stale.txt'), 'old');

        await copyMonitor(monitor, layout);

        const copied = await walkTree(layout.monitorPath);
        expect(copied.files.length).toBe(5);
        expect(fs.readFileSync(path.join(layout.monitorPath, 'nui', 'index.js'), 'utf8')).toBe('menu v1');
        expect(fs.existsSync(path.join(layout.monitorPath, 'stale.txt'))).toBe(false);
        expect(fs.existsSync(path.join(layout.monitorPath, 'empty'))).toBe(true);
    });

    it('refuses a source without a manifest', async () => {
        writeFile('monitor/entrypoint.js', 'entry');
        const layout = getBuildLayout(path.join(tmpRoot, 'build'), true);
        await expect(copyMonitor(path.join(tmpRoot, 'monitor'), layout)).rejects.toThrow('fxmanifest.lua');
    });
});


describe('getDirSize', () => {
    it('sums the nested files', async () => {
        const monitor = makeMonitor();
        const contents = ['fx_version "cerulean"', 'entry', 'core bundle', 'menu v1', 'lua'];
        expect(await getDirSize(monitor)).toBe(contents.reduce((total, text) => total + Buffer.byteLength(text), 0));
    });

    it('returns 0 for a missing folder', async () => {
        expect(await getDirSize(path.join(tmpRoot, 'missing'))).toBe(0);
    });
});


describe('extractArchive', () => {
    const hasWindowsTar = process.platform === 'win32' && fs.existsSync(windowsTarPath());

    const makeZip = async () => {
        writeFile('src/FXServer.exe', 'binary');
        writeFile('src/citizen/system_resources/monitor/fxmanifest.lua', 'manifest');
        const zipPath = path.join(tmpRoot, 'server.zip');
        await execa(windowsTarPath(), ['-a', '-cf', zipPath, '-C', path.join(tmpRoot, 'src'), 'FXServer.exe', 'citizen']);
        return zipPath;
    };

    const expectExtracted = (destDir: string) => {
        expect(fs.readFileSync(path.join(destDir, 'FXServer.exe'), 'utf8')).toBe('binary');
        expect(fs.readFileSync(path.join(destDir, 'citizen', 'system_resources', 'monitor', 'fxmanifest.lua'), 'utf8')).toBe('manifest');
    };

    it.skipIf(!hasWindowsTar)('extracts a zip with the system tar.exe', async () => {
        const zipPath = await makeZip();
        const destDir = path.join(tmpRoot, 'out');
        await extractArchive(zipPath, destDir, true, new JobControl());
        expectExtracted(destDir);
    });

    it.skipIf(!hasWindowsTar)('falls back to extracting in the panel when tar fails', async () => {
        const zipPath = await makeZip();
        const destDir = path.join(tmpRoot, 'out');
        await extractArchive(zipPath, destDir, true, new JobControl(), path.join(tmpRoot, 'no-tar.exe'));
        expectExtracted(destDir);
    });

    it('names the packages to install when tar or xz is missing on Linux', async () => {
        const destDir = path.join(tmpRoot, 'out');
        await expect(extractArchive(path.join(tmpRoot, 'fx.tar.xz'), destDir, false, new JobControl(), path.join(tmpRoot, 'no-tar')))
            .rejects.toThrow('xz-utils');
    });

    it('stops before starting when the job is cancelled', async () => {
        const job = new JobControl();
        job.cancel();
        await expect(extractArchive(path.join(tmpRoot, 'server.zip'), path.join(tmpRoot, 'out'), true, job))
            .rejects.toBeInstanceOf(DownloadCancelledError);
    });
});
