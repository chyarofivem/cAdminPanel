import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    applyResourceUpdate: vi.fn(),
    rollbackResource: vi.fn(),
    checkResourceUpdates: vi.fn(),
}));
vi.mock('@core/globalData', () => ({
    txEnv: { txaVersion: '1.0.0', profileSubPath: (...parts: string[]) => parts.join('/') },
}));
vi.mock('@lib/got', () => ({ default: vi.fn() }));
vi.mock('@lib/resources/updater', async (importOriginal) => ({
    ...await importOriginal<typeof import('./updater')>(),
    applyResourceUpdate: mocks.applyResourceUpdate,
    rollbackResource: mocks.rollbackResource,
    checkResourceUpdates: mocks.checkResourceUpdates,
}));

import ResourcesUpdates from '@routes/resources/updates';
import { ResourceUpdateError } from './updater';

const sendCommand = vi.fn(() => true);
const makeCtx = (action: string, body: unknown, admin: { isMaster: boolean; perms?: string[] }) => ({
    params: { action },
    request: { body },
    admin: {
        name: 'tester',
        isMaster: admin.isMaster,
        testPermission: vi.fn((perm: string) => admin.isMaster || Boolean(admin.perms?.includes(perm))),
        logAction: vi.fn(),
    },
    send: vi.fn((value: unknown) => value),
}) as any;

describe('resource updates route', () => {
    beforeEach(() => {
        sendCommand.mockClear();
        Object.values(mocks).forEach((mock) => mock.mockReset());
        vi.stubGlobal('txConfig', { server: { dataPath: '/srv/server-data' } });
        vi.stubGlobal('txCore', {
            fxRunner: { child: { isAlive: true }, sendCommand },
            fxResources: {
                resourceReport: {
                    ts: new Date(),
                    resources: [
                        { name: 'shop', status: 'started', path: '/srv/server-data/resources/shop', repository: 'https://github.com/o/shop' },
                        { name: 'monitor', status: 'started', path: '/srv/server-data/resources/monitor', repository: 'https://github.com/o/monitor' },
                    ],
                },
            },
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('requires commands.resources to check for updates', async () => {
        const ctx = makeCtx('check', {}, { isMaster: false });
        expect(await ResourcesUpdates(ctx)).toEqual({ success: false, error: 'forbidden' });
        expect(mocks.checkResourceUpdates).not.toHaveBeenCalled();
    });

    it('checks only resources the panel could replace', async () => {
        mocks.checkResourceUpdates.mockResolvedValue({ checkedAt: 1, results: {} });
        const ctx = makeCtx('check', {}, { isMaster: false, perms: ['commands.resources'] });
        expect(await ResourcesUpdates(ctx)).toEqual({ success: true, checkedAt: 1, results: {} });
        const checked = mocks.checkResourceUpdates.mock.calls[0][0].map((resource: { name: string }) => resource.name);
        expect(checked).toEqual(['shop']);
    });

    it('limits apply and rollback to the master account', async () => {
        const delegated = { isMaster: false, perms: ['all_permissions', 'commands.resources'] };
        expect(await ResourcesUpdates(makeCtx('apply', { resource: 'shop' }, delegated))).toEqual({ success: false, error: 'forbidden' });
        expect(await ResourcesUpdates(makeCtx('rollback', { resource: 'shop', backupId: '1760000000000_1.0.0' }, delegated)))
            .toEqual({ success: false, error: 'forbidden' });
        expect(mocks.applyResourceUpdate).not.toHaveBeenCalled();
        expect(mocks.rollbackResource).not.toHaveBeenCalled();
    });

    it('validates request bodies', async () => {
        const master = { isMaster: true };
        expect(await ResourcesUpdates(makeCtx('apply', { resource: '../shop' }, master))).toEqual({ success: false, error: 'invalid_request' });
        expect(await ResourcesUpdates(makeCtx('rollback', { resource: 'shop', backupId: '../../x' }, master)))
            .toEqual({ success: false, error: 'invalid_request' });
        expect(await ResourcesUpdates(makeCtx('delete', {}, master))).toEqual({ success: false, error: 'invalid_request' });
        expect(mocks.applyResourceUpdate).not.toHaveBeenCalled();
    });

    it('refreshes, logs and never restarts after an update', async () => {
        mocks.applyResourceUpdate.mockResolvedValue({
            resource: 'shop',
            version: '1.1.0',
            previousVersion: '1.0.0',
            backupId: '1760000000000_1.0.0',
            pendingRestart: true,
        });
        const ctx = makeCtx('apply', { resource: 'shop' }, { isMaster: true });
        expect(await ResourcesUpdates(ctx)).toEqual({
            success: true,
            resource: 'shop',
            version: '1.1.0',
            backupId: '1760000000000_1.0.0',
            pendingRestart: true,
        });
        expect(sendCommand).toHaveBeenCalledTimes(1);
        expect(sendCommand).toHaveBeenCalledWith('refresh', [], 'tester');
        expect(ctx.admin.logAction).toHaveBeenCalledWith(expect.stringContaining('Updated resource "shop" from 1.0.0 to 1.1.0'));
    });

    it('reports failures without refreshing', async () => {
        mocks.rollbackResource.mockRejectedValue(new ResourceUpdateError('backup_not_found'));
        const ctx = makeCtx('rollback', { resource: 'shop', backupId: '1760000000000_1.0.0' }, { isMaster: true });
        expect(await ResourcesUpdates(ctx)).toEqual({ success: false, error: 'backup_not_found' });
        expect(sendCommand).not.toHaveBeenCalled();
        expect(ctx.admin.logAction).not.toHaveBeenCalled();
    });
});
