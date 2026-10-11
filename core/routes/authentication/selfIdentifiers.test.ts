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

        expect(editAdmin).toHaveBeenCalledWith('admin', undefined, undefined, undefined, undefined);
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
        }, undefined, undefined);
        expect(ctx.send).toHaveBeenCalledWith({
            success: true,
            cfxIdentifier: undefined,
            discordIdentifier: 'discord:272800190639898628',
        });
    });
});

describe('self-managed Rockstar license', () => {
    afterEach(() => vi.unstubAllGlobals());
    const license = 'license:abcdef0123456789abcdef0123456789abcdef01';

    it('links a license so the in-game menu can match the account', async () => {
        const admin: any = { name: 'admin', providers: {} };
        const editAdmin = vi.fn(async (_name, _cfx, _discord, _perms, licenseData) => {
            admin.providers.license = licenseData;
        });
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => admin),
                getAdminByIdentifiers: vi.fn(() => false),
                editAdmin,
            },
        });
        const ctx = makeCtx({ cfxIdentifier: '', licenseIdentifier: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01' });

        await AuthSelfIdentifiers(ctx);

        expect(editAdmin).toHaveBeenCalledWith('admin', undefined, undefined, undefined, {
            id: 'abcdef0123456789abcdef0123456789abcdef01',
            identifier: license,
        });
        expect(ctx.send).toHaveBeenCalledWith(expect.objectContaining({ success: true, licenseIdentifier: license }));
    });

    it('rejects a license already linked to another administrator', async () => {
        const editAdmin = vi.fn();
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => ({ name: 'admin', providers: {} })),
                getAdminByIdentifiers: vi.fn(() => ({ name: 'someone-else' })),
                editAdmin,
            },
        });
        const ctx = makeCtx({ cfxIdentifier: '', licenseIdentifier: license });

        await AuthSelfIdentifiers(ctx);

        expect(editAdmin).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith({ error: `${license} is already linked to another administrator.` });
    });

    it('rejects text that is not a Rockstar license', async () => {
        const editAdmin = vi.fn();
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => ({ name: 'admin', providers: {} })),
                getAdminByIdentifiers: vi.fn(() => false),
                editAdmin,
            },
        });
        const ctx = makeCtx({ cfxIdentifier: '', licenseIdentifier: 'steam:110000112345678' });

        await AuthSelfIdentifiers(ctx);

        expect(editAdmin).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Rockstar license') }));
    });
});
