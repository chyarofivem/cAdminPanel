import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResourceMonitorActions from './actions';

const startSample = vi.fn();
const saveConfigs = vi.fn();

const makeCtx = (action: string, perms: string[], body?: unknown) => {
    const logAction = vi.fn();
    return {
        params: { action },
        request: { body },
        admin: {
            name: 'tester',
            testPermission: (perm: string) => perms.includes(perm),
            logAction,
        },
        send: vi.fn((value: unknown) => value),
        logAction,
    } as any;
};

const validSettings = {
    enabled: true,
    intervalMinutes: 10,
    frames: 200,
    alertThresholdMs: 2.5,
    alertConsecutive: 3,
    discordAlerts: false,
};

describe('resource monitor actions', () => {
    beforeEach(() => {
        startSample.mockReset();
        saveConfigs.mockReset();
        vi.stubGlobal('txCore', {
            resourceMonitor: { startSample },
            configStore: { saveConfigs },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requires commands.resources to sample', async () => {
        const ctx = makeCtx('sample', ['settings.write']);
        const resp = await ResourceMonitorActions(ctx);
        expect(resp).toMatchObject({ code: 'no_permission' });
        expect(startSample).not.toHaveBeenCalled();
    });

    it('starts a sample and reports why it could not start', async () => {
        startSample.mockReturnValueOnce(true).mockReturnValueOnce('server_offline');
        const ctx = makeCtx('sample', ['commands.resources']);
        expect(await ResourceMonitorActions(ctx)).toEqual({ success: true });
        expect(startSample).toHaveBeenCalledWith('manual');
        expect(ctx.logAction).toHaveBeenCalledTimes(1);
        expect(await ResourceMonitorActions(ctx)).toMatchObject({ code: 'server_offline' });
    });

    it('requires settings.write to save settings', async () => {
        const ctx = makeCtx('settings', ['commands.resources'], validSettings);
        expect(await ResourceMonitorActions(ctx)).toMatchObject({ code: 'no_permission' });
        expect(saveConfigs).not.toHaveBeenCalled();
    });

    it('validates the settings with the config schema', async () => {
        const ctx = makeCtx('settings', ['settings.write'], { ...validSettings, frames: 5000 });
        expect(await ResourceMonitorActions(ctx)).toMatchObject({ code: 'invalid_request' });
        const ctx2 = makeCtx('settings', ['settings.write'], { ...validSettings, intervalMinutes: 2.5 });
        expect(await ResourceMonitorActions(ctx2)).toMatchObject({ code: 'invalid_request' });
        expect(saveConfigs).not.toHaveBeenCalled();
    });

    it('saves valid settings and logs the change', async () => {
        const ctx = makeCtx('settings', ['settings.write'], { ...validSettings, extra: 'dropped' });
        expect(await ResourceMonitorActions(ctx)).toEqual({ success: true });
        expect(saveConfigs).toHaveBeenCalledWith({ resourceMonitor: validSettings }, 'tester');
        expect(ctx.logAction).toHaveBeenCalledTimes(1);
    });

    it('rejects unknown actions', async () => {
        const ctx = makeCtx('nope', ['all_permissions']);
        expect(await ResourceMonitorActions(ctx)).toMatchObject({ code: 'invalid_request' });
    });
});
