import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chyaroMocks = vi.hoisted(() => ({
    testConnection: vi.fn(),
}));

vi.mock('@lib/chyaroApi', () => ({
    testChyaroConnection: chyaroMocks.testConnection,
}));

import ChyaroSetup, {
    CHYARO_BOOTSTRAP_TTL_MS,
    hasValidChyaroBootstrap,
} from './chyaroSetup';

const makeCtx = (body: unknown) => {
    const ctx: any = {
        request: { body },
        status: 200,
        send: vi.fn((value: unknown) => value),
        sessTools: { set: vi.fn(), get: vi.fn(), destroy: vi.fn() },
        utils: {
            error: vi.fn((status: number, message: string) => {
                ctx.status = status;
                ctx.body = { status: 'error', code: status, message };
                return ctx.body;
            }),
        },
    };
    return ctx;
};

describe('chyarologin bootstrap authorization', () => {
    const validateAddMasterPin = vi.fn();
    const saveConfigs = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('txConfig', { chyaro: { apiUrl: 'https://identity.example', apiKey: '' } });
        vi.stubGlobal('txCore', {
            adminStore: {
                hasAdmins: vi.fn(() => false),
                validateAddMasterPin,
            },
            configStore: { saveConfigs },
        });
        validateAddMasterPin.mockReset();
        saveConfigs.mockReset();
        chyaroMocks.testConnection.mockReset();
    });

    afterEach(() => vi.unstubAllGlobals());

    it('rejects an attacker-controlled identity provider before making an outbound request', async () => {
        validateAddMasterPin.mockReturnValue(false);
        const ctx = makeCtx({
            action: 'save',
            apiUrl: 'https://attacker.example',
            apiKey: 'attacker-key',
            bootstrapPin: 'wrong',
        });

        await ChyaroSetup(ctx);

        expect(ctx.status).toBe(403);
        expect(ctx.send).toHaveBeenCalledWith({ success: false, message: 'The bootstrap PIN is incorrect.' });
        expect(chyaroMocks.testConnection).not.toHaveBeenCalled();
        expect(saveConfigs).not.toHaveBeenCalled();
        expect(ctx.sessTools.set).not.toHaveBeenCalled();
    });

    it('binds a successful provider save to the authorized browser session', async () => {
        validateAddMasterPin.mockReturnValue(true);
        chyaroMocks.testConnection.mockResolvedValue(['admin@example.com']);
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
        const ctx = makeCtx({
            action: 'save',
            apiUrl: 'https://identity.example/',
            apiKey: 'valid-key',
            bootstrapPin: 'valid-pin',
        });

        await ChyaroSetup(ctx);

        expect(saveConfigs).toHaveBeenCalledWith({
            chyaro: { apiUrl: 'https://identity.example', apiKey: 'valid-key' },
        }, 'chyarologin bootstrap');
        expect(ctx.sessTools.set).toHaveBeenCalledWith({
            tmpChyaroBootstrapExpiresAt: 1_000 + CHYARO_BOOTSTRAP_TTL_MS,
        });
        now.mockRestore();
    });

    it('can authorize a preconfigured provider without exposing or replacing its key', async () => {
        (globalThis as any).txConfig.chyaro.apiKey = 'already-configured';
        validateAddMasterPin.mockReturnValue(true);
        const ctx = makeCtx({ action: 'authorize', bootstrapPin: 'valid-pin' });

        await ChyaroSetup(ctx);

        expect(ctx.sessTools.set).toHaveBeenCalledOnce();
        expect(chyaroMocks.testConnection).not.toHaveBeenCalled();
        expect(saveConfigs).not.toHaveBeenCalled();
    });

    it('expires the browser bootstrap authorization', () => {
        expect(hasValidChyaroBootstrap({ tmpChyaroBootstrapExpiresAt: 1_001 }, 1_000)).toBe(true);
        expect(hasValidChyaroBootstrap({ tmpChyaroBootstrapExpiresAt: 1_000 }, 1_000)).toBe(false);
        expect(hasValidChyaroBootstrap(undefined, 1_000)).toBe(false);
    });
});
