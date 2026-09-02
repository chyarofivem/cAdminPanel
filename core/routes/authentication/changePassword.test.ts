import { afterEach, describe, expect, it, vi } from 'vitest';
import consts from '@shared/consts';
import AuthChangePassword from './changePassword';

const makeCtx = (auth: any, isTempPassword = false, newPassword = 'new-password') => {
    const ctx: any = {
        request: { body: { newPassword } },
        admin: { name: 'admin', isTempPassword, logAction: vi.fn() },
        sessTools: { get: vi.fn(() => ({ auth })), set: vi.fn() },
        send: vi.fn((value: unknown) => value),
    };
    return ctx;
};

describe('local password management', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('rejects a new password shorter than the minimum length', async () => {
        const setAdminPassword = vi.fn();
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => ({ password_hash: '$2b$temp' })),
                setAdminPassword,
            },
        });
        const ctx = makeCtx({ type: 'password' }, true, 'abc');

        await AuthChangePassword(ctx);

        expect(ctx.send).toHaveBeenCalledWith({
            error: `Password must be between ${consts.adminPasswordMinLength} and ${consts.adminPasswordMaxLength} characters.`,
        });
        expect(setAdminPassword).not.toHaveBeenCalled();
    });

    it('requires the current password during a normal password session', async () => {
        const setAdminPassword = vi.fn();
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => ({ password_hash: '$2b$current' })),
                setAdminPassword,
            },
        });
        const ctx = makeCtx({ type: 'password' });

        await AuthChangePassword(ctx);

        expect(ctx.send).toHaveBeenCalledWith({ error: 'Wrong current password.' });
        expect(setAdminPassword).not.toHaveBeenCalled();
    });

    it('updates the active password session after replacing a temporary password', async () => {
        const setAdminPassword = vi.fn(async () => '$2b$new-hash');
        vi.stubGlobal('txCore', {
            adminStore: {
                getAdminByName: vi.fn(() => ({ password_hash: '$2b$temp' })),
                setAdminPassword,
            },
        });
        const auth = {
            type: 'password',
            username: 'admin',
            csrfToken: 'csrf',
            expiresAt: false,
            password_hash: '$2b$temp',
        };
        const ctx = makeCtx(auth, true);

        await AuthChangePassword(ctx);

        expect(ctx.sessTools.set).toHaveBeenCalledWith({
            auth: { ...auth, password_hash: '$2b$new-hash' },
        });
    });
});
