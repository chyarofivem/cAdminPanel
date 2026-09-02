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

        expect(editAdmin).toHaveBeenCalledWith('target', false, false, []);
        expect(ctx.send).toHaveBeenCalledWith({ type: 'success', refresh: true });
    });
});
