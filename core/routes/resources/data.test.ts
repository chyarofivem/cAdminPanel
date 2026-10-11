import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    profileSubPath: (..._parts: string[]): string => '',
}));
vi.mock('@core/globalData', () => ({
    txEnv: {
        profileSubPath: (...parts: string[]) => mocks.profileSubPath(...parts),
    },
}));

import ResourcesData from './data';
import { resourceUpdateState } from '@lib/resources/state';

const sendCommand = vi.fn(() => true);
let tmpRoot: string;
let dataPath: string;
let profilePath: string;
let systemPath: string;

const stubCore = (resourceReport: unknown, latestBootLog: unknown = null) => {
    vi.stubGlobal('txConfig', {
        server: { dataPath },
    });
    vi.stubGlobal('txCore', {
        fxRunner: {
            child: { isAlive: true },
            sendCommand,
        },
        fxResources: { resourceReport, latestBootLog },
    });
};

describe('resources data', () => {
    beforeAll(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cadmin-resdata-'));
        dataPath = path.join(tmpRoot, 'server-data');
        profilePath = path.join(tmpRoot, 'txData', 'default');
        systemPath = path.join(tmpRoot, 'fxserver', 'citizen', 'system_resources');
        mocks.profileSubPath = (...parts: string[]) => path.join(profilePath, ...parts);
        const backupsDir = path.join(profilePath, 'data', 'resource-backups');
        fs.mkdirSync(path.join(backupsDir, 'ox_lib', '1760000000000_2.9.0'), { recursive: true });
        fs.mkdirSync(path.join(backupsDir, 'ox_lib', 'junk'), { recursive: true });
        fs.mkdirSync(path.join(backupsDir, 'ox_lib', '.partial-1760000001000_3.0.0'), { recursive: true });
    });

    afterAll(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
        vi.setSystemTime(new Date('2026-08-10T12:00:00Z'));
        sendCommand.mockClear();
        resourceUpdateState.reset();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('returns the cached report if a fresh response misses the deadline', async () => {
        stubCore({
            ts: new Date('2026-08-10T11:59:00Z'),
            resources: [{
                name: 'monitor',
                status: 'started',
                path: path.join(systemPath, 'monitor'),
            }],
        });
        const ctx = { send: vi.fn((value: unknown) => value) } as any;

        const responsePromise = ResourcesData(ctx);
        await vi.advanceTimersByTimeAsync(8_000);
        const response = await responsePromise;

        expect(sendCommand).toHaveBeenCalledWith('txaReportResources', [], expect.any(Symbol));
        expect(response).toMatchObject({
            success: true,
            data: {
                generatedAt: new Date('2026-08-10T11:59:00Z').getTime(),
                resources: [{ name: 'monitor', status: 'started', canUpdate: false, dependencies: [], dependents: [] }],
                bootOrder: null,
            },
        });
    });

    it('reports a timeout when no report exists at the deadline', async () => {
        stubCore(undefined);
        const ctx = { send: vi.fn((value: unknown) => value) } as any;
        const responsePromise = ResourcesData(ctx);
        await vi.advanceTimersByTimeAsync(8_000);
        expect(await responsePromise).toEqual({ success: false, error: 'report_timeout' });
    });

    it('adds dependencies, update state, backups and the boot order without exposing paths', async () => {
        const now = Date.now();
        stubCore({
            ts: new Date(now),
            resources: [
                {
                    name: 'monitor',
                    status: 'started',
                    path: path.join(systemPath, 'monitor'),
                    dependencies: {},
                },
                {
                    name: 'ox_lib',
                    status: 'started',
                    version: '3.0.0',
                    path: path.join(dataPath, 'resources', '[ox]', 'ox_lib'),
                    repository: 'https://github.com/overextended/ox_lib.git',
                    dependencies: ['/server:5181', '/onesync'],
                },
                {
                    name: 'my_shop',
                    status: 'started',
                    version: '1.0.0',
                    author: ' Someone ',
                    path: path.join(dataPath, 'resources', '[local]', 'my_shop'),
                    repository: 'git@github.com:me/shop.git',
                    dependencies: ['OX_LIB', 'oxmysql', 'ox_lib', 7],
                },
                {
                    name: 'docs_link',
                    status: 'stopped',
                    path: path.join(tmpRoot, 'elsewhere', 'docs_link'),
                    repository: 'javascript:alert(1)',
                },
            ],
        }, [
            { resource: 'ox_lib', duration: 120.4, tsBooted: now - 5_000 },
            { resource: 'my_shop', duration: 1500, tsBooted: now - 4_000 },
            { resource: 'monitor', duration: -1, tsBooted: now - 3_000 },
            { resource: 'ox_lib', duration: 50, tsBooted: now - 1_000 },
        ]);
        resourceUpdateState.setCheck('ox_lib', {
            repoSlug: 'overextended/ox_lib',
            checkedAt: now - 60_000,
            expiresAt: now + 60_000,
            latest: '3.1.0',
            releaseUrl: 'https://github.com/overextended/ox_lib/releases/tag/v3.1.0',
            publishedAt: '2026-08-01T00:00:00Z',
        });
        resourceUpdateState.markPendingRestart('my_shop', now - 2_000);

        const ctx = { send: vi.fn((value: unknown) => value) } as any;
        const responsePromise = ResourcesData(ctx);
        await vi.advanceTimersByTimeAsync(50);
        const response: any = await responsePromise;
        expect(response.success).toBe(true);
        const byName = Object.fromEntries(response.data.resources.map((resource: any) => [resource.name, resource]));

        expect(byName.ox_lib).toMatchObject({
            group: '[ox]',
            dependencies: [],
            dependents: ['my_shop'],
            repositoryUrl: 'https://github.com/overextended/ox_lib',
            githubRepo: 'overextended/ox_lib',
            canUpdate: true,
            update: { current: '3.0.0', latest: '3.1.0', hasUpdate: true },
            backups: [{ id: '1760000000000_2.9.0', version: '2.9.0', createdAt: 1760000000000 }],
            pendingRestart: false,
        });
        expect(byName.my_shop).toMatchObject({
            author: 'Someone',
            dependencies: [
                { name: 'OX_LIB', missing: false },
                { name: 'oxmysql', missing: true },
                { name: 'ox_lib', missing: false },
            ],
            dependents: [],
            repository: 'git@github.com:me/shop.git',
            repositoryUrl: null,
            githubRepo: null,
            canUpdate: true,
            update: null,
            backups: [],
            pendingRestart: true,
        });
        expect(byName.monitor).toMatchObject({ group: 'system_resources', canUpdate: false });
        expect(byName.docs_link).toMatchObject({ group: 'elsewhere', canUpdate: false, repositoryUrl: null });
        expect(byName.my_shop.group).toBe('[local]');

        expect(response.data.bootOrder).toEqual([
            { position: 1, resource: 'ox_lib', duration: 120, tsBooted: now - 5_000 },
            { position: 2, resource: 'my_shop', duration: 1500, tsBooted: now - 4_000 },
            { position: 3, resource: 'monitor', duration: -1, tsBooted: now - 3_000 },
        ]);

        const serialized = JSON.stringify(response);
        expect(serialized).not.toContain(path.basename(tmpRoot));
        expect(response.data.resources.every((resource: any) => !('path' in resource))).toBe(true);
    });

    it('rejects requests while the server is offline', async () => {
        stubCore(undefined);
        (txCore as any).fxRunner.child.isAlive = false;
        const ctx = { send: vi.fn((value: unknown) => value) } as any;
        expect(await ResourcesData(ctx)).toEqual({ success: false, error: 'server_offline' });
        expect(sendCommand).not.toHaveBeenCalled();
    });
});
