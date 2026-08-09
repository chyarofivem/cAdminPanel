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

    it('rejects manual Discord changes when chyarologin is linked', async () => {
        const editAdmin = vi.fn();
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => ({
                    name: 'admin',
                    providers: { chyarologin: { identifier: 'admin@example.com', data: {} } },
                })),
                editAdmin,
            },
        });
        const ctx = makeCtx({
            cfxIdentifier: '',
            discordIdentifier: '272800190639898628',
        });

        await AuthSelfIdentifiers(ctx);

        expect(ctx.send).toHaveBeenCalledWith({
            error: 'Discord must be connected or disconnected through chyarologin for this account.',
        });
        expect(editAdmin).not.toHaveBeenCalled();
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
