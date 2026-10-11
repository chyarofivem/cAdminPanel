import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    profileSubPath: (..._parts: string[]): string => '',
    stream: vi.fn(),
}));
vi.mock('@core/globalData', () => ({
    txEnv: {
        txaVersion: '1.0.0',
        profileSubPath: (...parts: string[]) => mocks.profileSubPath(...parts),
    },
}));
vi.mock('@lib/got', () => ({
    default: Object.assign(vi.fn(() => { throw new Error('no network in tests'); }), {
        stream: (...args: unknown[]) => mocks.stream(...args),
    }),
}));

import { resourceUpdateState } from './state';
import {
    type ReleaseFetcher,
    applyResourceUpdate,
    checkResourceUpdates,
    extractArchive,
    rollbackResource,
    runWithConcurrency,
} from './updater';


//MARK: Minimal zip writer (stored entries) so tests never need a real download
const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();
const crc32 = (data: Buffer) => {
    let c = 0xffffffff;
    for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const buildZip = (files: Record<string, string>) => {
    const parts: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    const entries = Object.entries(files);
    for (const [name, content] of entries) {
        const nameBuf = Buffer.from(name, 'utf8');
        const data = Buffer.from(content, 'utf8');
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        parts.push(local, nameBuf, data);

        const header = Buffer.alloc(46);
        header.writeUInt32LE(0x02014b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(20, 6);
        header.writeUInt32LE(crc, 16);
        header.writeUInt32LE(data.length, 20);
        header.writeUInt32LE(data.length, 24);
        header.writeUInt16LE(nameBuf.length, 28);
        header.writeUInt32LE(offset, 42);
        central.push(header, nameBuf);
        offset += local.length + nameBuf.length + data.length;
    }
    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, centralBuf, end]);
};


let tmpRoot: string;
let caseCount = 0;
beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cadmin-resupdater-'));
});
afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});
beforeEach(() => {
    resourceUpdateState.reset();
    mocks.stream.mockReset();
});
afterEach(() => {
    vi.unstubAllGlobals();
});


describe('runWithConcurrency', () => {
    it('never runs more than the limit at once', async () => {
        let active = 0;
        let peak = 0;
        const done: number[] = [];
        await runWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (item) => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active--;
            done.push(item);
        });
        expect(peak).toBe(4);
        expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
});


describe('checkResourceUpdates', () => {
    const release = (tag: string) => ({
        ok: true as const,
        release: {
            tag_name: tag,
            html_url: `https://github.com/x/y/releases/tag/${tag}`,
            published_at: '2026-10-01T10:00:00Z',
            zipball_url: 'https://api.github.com/repos/x/y/zipball/v1',
            assets: [],
        },
    });

    it('asks once per repository, at most four at a time, and caches the results', async () => {
        let active = 0;
        let peak = 0;
        const fetcher = vi.fn<ReleaseFetcher>(async (repo) => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active--;
            if (repo.repo === 'missing') return { ok: false, error: 'no_release' };
            return release('v2.0.0');
        });
        const resources = [
            { name: 'a', version: '1.0.0', repository: 'https://github.com/owner/shared' },
            { name: 'b', version: '2.0.0', repository: 'https://github.com/Owner/Shared.git' },
            { name: 'c', version: '1.0.0', repository: 'https://example.com/owner/c' },
            { name: 'd', version: 'dev', repository: 'https://github.com/owner/d' },
            { name: 'e', version: '1.0.0', repository: 'https://github.com/owner/missing' },
            ...[1, 2, 3, 4].map((n) => ({ name: `r${n}`, version: '1.0.0', repository: `https://github.com/owner/r${n}` })),
        ];

        const first = await checkResourceUpdates(resources, fetcher);
        expect(fetcher).toHaveBeenCalledTimes(7);
        expect(peak).toBeLessThanOrEqual(4);
        expect(Object.keys(first.results).sort()).toEqual(['a', 'b', 'd', 'e', 'r1', 'r2', 'r3', 'r4']);
        expect(first.results.a).toMatchObject({ current: '1.0.0', latest: '2.0.0', hasUpdate: true, publishedAt: '2026-10-01T10:00:00Z' });
        expect(first.results.b).toMatchObject({ latest: '2.0.0', hasUpdate: false });
        expect(first.results.d).toMatchObject({ hasUpdate: false, error: 'unknown_version' });
        expect(first.results.e).toMatchObject({ hasUpdate: false, error: 'no_release' });

        const second = await checkResourceUpdates(resources, fetcher);
        expect(fetcher).toHaveBeenCalledTimes(7);
        expect(second.results.a).toMatchObject({ hasUpdate: true });
    });

    it('stops asking GitHub while rate limited', async () => {
        const fetcher = vi.fn<ReleaseFetcher>(async () => ({ ok: false, error: 'rate_limited', retryAt: Date.now() + 60_000 }));
        const first = await checkResourceUpdates([{ name: 'a', version: '1.0.0', repository: 'https://github.com/o/a' }], fetcher);
        expect(first.results.a.error).toBe('rate_limited');

        const second = await checkResourceUpdates([{ name: 'z', version: '1.0.0', repository: 'https://github.com/o/z' }], fetcher);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(second.results.z.error).toBe('rate_limited');
    });
});


describe('extractArchive', () => {
    it('rejects entries that climb out of the target folder', async () => {
        const dir = path.join(tmpRoot, `zip-${++caseCount}`);
        fs.mkdirSync(dir, { recursive: true });
        const zipFile = path.join(dir, 'evil.zip');
        fs.writeFileSync(zipFile, buildZip({ 'fxmanifest.lua': 'x', '../evil.lua': 'x' }));
        await expect(extractArchive(zipFile, path.join(dir, 'out'))).rejects.toMatchObject({ code: 'invalid_archive' });
        expect(fs.existsSync(path.join(dir, 'evil.lua'))).toBe(false);
    });

    it('rejects files that are not zips', async () => {
        const dir = path.join(tmpRoot, `zip-${++caseCount}`);
        fs.mkdirSync(dir, { recursive: true });
        const zipFile = path.join(dir, 'broken.zip');
        fs.writeFileSync(zipFile, 'not a zip');
        await expect(extractArchive(zipFile, path.join(dir, 'out'))).rejects.toMatchObject({ code: 'invalid_archive' });
    });
});


describe('apply and rollback', () => {
    const setupServer = (resourceOverrides: Record<string, unknown> = {}) => {
        const caseDir = path.join(tmpRoot, `server-${++caseCount}`);
        const dataPath = path.join(caseDir, 'server-data');
        const profile = path.join(caseDir, 'txData', 'default');
        const resourceDir = path.join(dataPath, 'resources', '[local]', 'shop');
        fs.mkdirSync(path.join(resourceDir, 'client'), { recursive: true });
        fs.writeFileSync(path.join(resourceDir, 'fxmanifest.lua'), "version '1.0.0'");
        fs.writeFileSync(path.join(resourceDir, 'client', 'main.lua'), 'old');
        fs.writeFileSync(path.join(resourceDir, 'config.lua'), 'edited by the owner');
        mocks.profileSubPath = (...parts: string[]) => path.join(profile, ...parts);

        vi.stubGlobal('txConfig', { server: { dataPath } });
        vi.stubGlobal('txCore', {
            fxRunner: { child: { isAlive: true } },
            fxResources: {
                resourceReport: {
                    ts: new Date(),
                    resources: [{
                        name: 'shop',
                        status: 'started',
                        version: '1.0.0',
                        path: resourceDir,
                        repository: 'https://github.com/owner/shop',
                        ...resourceOverrides,
                    }],
                },
            },
        });
        return { dataPath, profile, resourceDir, backupsDir: path.join(profile, 'data', 'resource-backups', 'shop') };
    };
    const cacheRelease = (downloadUrl = 'https://github.com/owner/shop/releases/download/v1.1.0/shop.zip') => {
        resourceUpdateState.setCheck('shop', {
            repoSlug: 'owner/shop',
            checkedAt: Date.now(),
            expiresAt: Date.now() + 60_000,
            latest: '1.1.0',
            releaseUrl: 'https://github.com/owner/shop/releases/tag/v1.1.0',
            download: { url: downloadUrl, name: 'shop.zip' },
        });
    };
    const serveZip = (files: Record<string, string>) => {
        mocks.stream.mockImplementation(() => Readable.from([buildZip(files)]));
    };

    it('installs the release, keeps a backup and rolls it back', async () => {
        const { resourceDir, backupsDir } = setupServer();
        cacheRelease();
        serveZip({
            'shop-1.1.0/fxmanifest.lua': "version '1.1.0'",
            'shop-1.1.0/client/main.lua': 'new',
        });

        const result = await applyResourceUpdate('shop');
        expect(mocks.stream).toHaveBeenCalledWith('https://github.com/owner/shop/releases/download/v1.1.0/shop.zip', expect.anything());
        expect(result).toMatchObject({ resource: 'shop', version: '1.1.0', previousVersion: '1.0.0', pendingRestart: true });
        expect(result.backupId).toMatch(/^\d{13}_1\.0\.0$/);
        expect(fs.readFileSync(path.join(resourceDir, 'client', 'main.lua'), 'utf8')).toBe('new');
        expect(fs.existsSync(path.join(resourceDir, 'config.lua'))).toBe(false);
        expect(fs.readFileSync(path.join(backupsDir, result.backupId, 'config.lua'), 'utf8')).toBe('edited by the owner');
        expect(fs.existsSync(`${resourceDir}.cadmin-new`)).toBe(false);
        expect(fs.existsSync(`${resourceDir}.cadmin-old`)).toBe(false);
        expect(resourceUpdateState.isPendingRestart('shop', 'started', [])).toBe(true);

        const rollback = await rollbackResource('shop', result.backupId);
        expect(rollback.version).toBe('1.0.0');
        expect(fs.readFileSync(path.join(resourceDir, 'client', 'main.lua'), 'utf8')).toBe('old');
        expect(fs.readFileSync(path.join(resourceDir, 'config.lua'), 'utf8')).toBe('edited by the owner');
        //The rolled-back files were themselves backed up, and the restored backup is kept
        expect(fs.readdirSync(backupsDir).sort()).toEqual([result.backupId, rollback.backupId].sort());
    });

    it('requires a cached check that shows an update', async () => {
        setupServer();
        await expect(applyResourceUpdate('shop')).rejects.toMatchObject({ code: 'check_required' });

        setupServer({ version: '1.1.0' });
        cacheRelease();
        await expect(applyResourceUpdate('shop')).rejects.toMatchObject({ code: 'check_required' });
        expect(mocks.stream).not.toHaveBeenCalled();
    });

    it('rejects folders outside the server data folder, system resources and the monitor', async () => {
        const { dataPath } = setupServer({ path: path.join(tmpRoot, 'elsewhere', 'shop') });
        cacheRelease();
        await expect(applyResourceUpdate('shop')).rejects.toMatchObject({ code: 'path_rejected' });

        setupServer({ path: path.join(dataPath, 'citizen', 'system_resources', 'shop') });
        cacheRelease();
        await expect(applyResourceUpdate('shop')).rejects.toMatchObject({ code: 'path_rejected' });

        setupServer({ name: 'monitor' });
        resourceUpdateState.setCheck('monitor', {
            repoSlug: 'owner/shop',
            checkedAt: Date.now(),
            expiresAt: Date.now() + 60_000,
            latest: '1.1.0',
            download: { url: 'https://github.com/owner/shop/releases/download/v1.1.0/shop.zip', name: 'shop.zip' },
        });
        await expect(applyResourceUpdate('monitor')).rejects.toMatchObject({ code: 'not_updatable' });
        expect(mocks.stream).not.toHaveBeenCalled();
    });

    it('refuses download URLs outside the checked repository', async () => {
        setupServer();
        cacheRelease('https://example.com/shop.zip');
        await expect(applyResourceUpdate('shop')).rejects.toMatchObject({ code: 'no_asset' });
    });

    it('leaves the resource untouched when the archive has no manifest', async () => {
        const { resourceDir, backupsDir } = setupServer();
        cacheRelease();
        serveZip({ 'shop/README.md': 'hello' });
        await expect(applyResourceUpdate('shop')).rejects.toMatchObject({ code: 'manifest_not_found' });
        expect(fs.readFileSync(path.join(resourceDir, 'client', 'main.lua'), 'utf8')).toBe('old');
        expect(fs.existsSync(backupsDir)).toBe(false);
    });

    it('only rolls back to listed backups', async () => {
        setupServer();
        await expect(rollbackResource('shop', '1760000000000_9.9.9')).rejects.toMatchObject({ code: 'backup_not_found' });
        await expect(rollbackResource('shop', '../../etc')).rejects.toMatchObject({ code: 'invalid_request' });
        await expect(rollbackResource('../shop', '1760000000000_9.9.9')).rejects.toMatchObject({ code: 'invalid_request' });
    });

    it('requires a running server', async () => {
        setupServer();
        (txCore as any).fxRunner.child.isAlive = false;
        cacheRelease();
        await expect(applyResourceUpdate('shop')).rejects.toMatchObject({ code: 'server_offline' });
    });
});
