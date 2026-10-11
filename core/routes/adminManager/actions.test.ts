import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminManagerActions from './actions';

const makeCtx = (password = '') => ({
    params: { action: 'edit' },
    request: {
        body: {
            name: 'target',
            password,
            citizenfxID: '',
            discordID: '',
            permissions: [],
        },
    },
    admin: {
        name: 'actor',
        isMaster: true,
        permissions: ['all_permissions'],
        testPermission: vi.fn(() => true),
        logAction: vi.fn(),
    },
    utils: { error: vi.fn() },
    send: vi.fn((value: unknown) => value),
}) as any;

describe('administrator management password boundaries', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('rejects password changes for an existing administrator', async () => {
        const editAdmin = vi.fn();
        vi.stubGlobal('txCore', { adminStore: { editAdmin } });
        const ctx = makeCtx('replacement-password');

        await AdminManagerActions(ctx);

        expect(ctx.send).toHaveBeenCalledWith({
            type: 'danger',
            message: 'Administrators must change their own local password in User Settings.',
        });
        expect(editAdmin).not.toHaveBeenCalled();
    });

    it('still permits editing non-password administrator fields', async () => {
        const editAdmin = vi.fn(async () => true);
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => ({
                    name: 'target',
                    master: false,
                    providers: {},
                    permissions: [],
                })),
                editAdmin,
            },
        });
        const ctx = makeCtx();

        await AdminManagerActions(ctx);

        expect(editAdmin).toHaveBeenCalledWith('target', false, false, [], undefined);
        expect(ctx.send).toHaveBeenCalledWith({ type: 'success', refresh: true });
    });
});

describe('administrator Rockstar license', () => {
    afterEach(() => vi.unstubAllGlobals());
    const stubStore = () => {
        const editAdmin = vi.fn(async () => true);
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => ({ name: 'target', master: false, providers: {}, permissions: [] })),
                editAdmin,
            },
        });
        return editAdmin;
    };

    it('links a license given in any accepted form', async () => {
        const editAdmin = stubStore();
        const ctx = makeCtx();
        ctx.request.body.licenseID = '  LICENSE2:ABCDEF0123456789ABCDEF0123456789ABCDEF01 ';

        await AdminManagerActions(ctx);

        expect(editAdmin).toHaveBeenCalledWith('target', false, false, [], {
            id: 'abcdef0123456789abcdef0123456789abcdef01',
            identifier: 'license:abcdef0123456789abcdef0123456789abcdef01',
        });
    });

    it('removes the license when the field is sent empty', async () => {
        const editAdmin = stubStore();
        const ctx = makeCtx();
        ctx.request.body.licenseID = '';

        await AdminManagerActions(ctx);

        expect(editAdmin).toHaveBeenCalledWith('target', false, false, [], false);
    });

    it('rejects a malformed license without editing the account', async () => {
        const editAdmin = stubStore();
        const ctx = makeCtx();
        ctx.request.body.licenseID = 'license:1234';

        await AdminManagerActions(ctx);

        expect(editAdmin).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'danger' }));
    });
});
