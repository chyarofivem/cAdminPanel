import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthSelfIdentifiers from './selfIdentifiers';

const makeCtx = (body: unknown) => {
    const ctx: any = {
        request: { body },
        admin: { name: 'admin', logAction: vi.fn() },
        send: vi.fn((value: unknown) => value),
        utils: { error: vi.fn((status: number, message: string) => ({ status, message })) },
    };
    return ctx;
};

describe('self-managed Discord identity', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('leaves the stored Discord provider untouched when the field is omitted', async () => {
        const admin: any = {
            name: 'admin',
            providers: {
                discord: { id: '272800190639898628', identifier: 'discord:272800190639898628', data: {} },
            },
        };
        const editAdmin = vi.fn();
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => admin),
                getAdminByIdentifiers: vi.fn(() => false),
                editAdmin,
            },
        });
        const ctx = makeCtx({ cfxIdentifier: '' });

        await AuthSelfIdentifiers(ctx);

        expect(editAdmin).toHaveBeenCalledWith('admin', undefined, undefined);
        expect(ctx.send).toHaveBeenCalledWith({
            success: true,
            cfxIdentifier: undefined,
            discordIdentifier: 'discord:272800190639898628',
        });
    });

    it('stores a normalized Discord identifier for a local-only account', async () => {
        const admin: any = { name: 'admin', providers: {} };
        const editAdmin = vi.fn(async (_name, _cfx, discord) => {
            admin.providers.discord = discord;
        });
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => admin),
                getAdminByIdentifiers: vi.fn(() => false),
                editAdmin,
            },
        });
        const ctx = makeCtx({
            cfxIdentifier: '',
            discordIdentifier: 'discord:272800190639898628',
        });

        await AuthSelfIdentifiers(ctx);

        expect(editAdmin).toHaveBeenCalledWith('admin', undefined, {
            id: '272800190639898628',
            identifier: 'discord:272800190639898628',
        });
        expect(ctx.send).toHaveBeenCalledWith({
            success: true,
            cfxIdentifier: undefined,
            discordIdentifier: 'discord:272800190639898628',
        });
    });
});
