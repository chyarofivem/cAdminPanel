import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthSelfPreferences from './selfPreferences';

const makeCtx = (body: unknown) => ({
    request: { body },
    admin: {
        name: 'admin',
        locale: 'en',
        accent: undefined,
        logAction: vi.fn(),
    },
    send: vi.fn((value: unknown) => value),
} as any);

describe('administrator account preferences', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('persists and returns an account accent with its game-menu colour', async () => {
        const setAdminPreferences = vi.fn(async () => undefined);
        vi.stubGlobal('txCore', { adminStore: { setAdminPreferences } });
        const ctx = makeCtx({ accent: 'rose' });

        await AuthSelfPreferences(ctx);

        expect(setAdminPreferences).toHaveBeenCalledWith('admin', { accent: 'rose' });
        expect(ctx.send).toHaveBeenCalledWith({
            success: true,
            locale: 'en',
            accent: 'rose',
            accentColor: '#e11d48',
        });
    });

    it('rejects unknown accents without modifying the account', async () => {
        const setAdminPreferences = vi.fn();
        vi.stubGlobal('txCore', { adminStore: { setAdminPreferences } });
        const ctx = makeCtx({ accent: 'chartreuse' });

        await AuthSelfPreferences(ctx);

        expect(setAdminPreferences).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith({ error: 'Choose a valid account preference.' });
    });

    it('continues to persist the personal language', async () => {
        const setAdminPreferences = vi.fn(async () => undefined);
        vi.stubGlobal('txCore', { adminStore: { setAdminPreferences } });
        const ctx = makeCtx({ locale: 'hr' });

        await AuthSelfPreferences(ctx);

        expect(setAdminPreferences).toHaveBeenCalledWith('admin', { locale: 'hr' });
        expect(ctx.send).toHaveBeenCalledWith({
            success: true,
            locale: 'hr',
            accent: undefined,
            accentColor: undefined,
        });
    });

    it('rejects inherited object keys as languages', async () => {
        const setAdminPreferences = vi.fn();
        vi.stubGlobal('txCore', { adminStore: { setAdminPreferences } });
        const ctx = makeCtx({ locale: 'toString' });

        await AuthSelfPreferences(ctx);

        expect(setAdminPreferences).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith({ error: 'That language is not available.' });
    });
});
