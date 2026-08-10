import { afterEach, describe, expect, test, vi } from 'vitest';
import { AuthedAdmin, normalAuthLogic } from './authLogic';

const hasPermission = (isMaster: boolean, permissions: string[], permission: string) => (
    AuthedAdmin.prototype.hasPermission.call({ isMaster, permissions }, permission)
);

describe('AuthedAdmin permission boundaries', () => {
    test('all_permissions grants normal registered permissions', () => {
        expect(hasPermission(false, ['all_permissions'], 'settings.write')).toBe(true);
        expect(hasPermission(false, ['all_permissions'], 'cadmin.garage.manage')).toBe(true);
        expect(hasPermission(false, ['all_permissions'], 'manage.admins')).toBe(true);
    });

    test('all_permissions never satisfies the special master boundary', () => {
        expect(hasPermission(false, ['all_permissions'], 'master')).toBe(false);
        expect(hasPermission(true, [], 'master')).toBe(true);
    });

    test('an exact permission still grants access without the wildcard', () => {
        expect(hasPermission(false, ['cadmin.players.view'], 'cadmin.players.view')).toBe(true);
        expect(hasPermission(false, ['cadmin.players.view'], 'cadmin.garage.manage')).toBe(false);
    });
});

const vaultAdmin = (overrides: Record<string, unknown> = {}) => ({
    name: 'admin',
    master: true,
    permissions: [],
    password_hash: '$2b$hash',
    providers: {},
    ...overrides,
});

describe('administrator authentication methods', () => {
    afterEach(() => vi.unstubAllGlobals());

    test('accepts a password session while its stored hash is unchanged', () => {
        vi.stubGlobal('txCore', {
            adminStore: { getAdminByName: vi.fn(() => vaultAdmin()) },
            cacheStore: { get: vi.fn() },
        });
        const result = normalAuthLogic({
            get: () => ({
                auth: {
                    type: 'password',
                    username: 'admin',
                    csrfToken: 'csrf',
                    expiresAt: false,
                    password_hash: '$2b$hash',
                },
            }),
        } as any);

        expect(result.success).toBe(true);
    });

    test('invalidates a password session after the stored password changes', () => {
        vi.stubGlobal('txCore', {
            adminStore: { getAdminByName: vi.fn(() => vaultAdmin({ password_hash: '$2b$new' })) },
            cacheStore: { get: vi.fn() },
        });
        const result = normalAuthLogic({
            get: () => ({
                auth: {
                    type: 'password',
                    username: 'admin',
                    csrfToken: 'csrf',
                    expiresAt: false,
                    password_hash: '$2b$old',
                },
            }),
        } as any);

        expect(result).toMatchObject({ success: false });
    });

    test('never falls back to a manual Discord provider once chyarologin is linked', () => {
        vi.stubGlobal('txCore', { cacheStore: { get: vi.fn() } });
        const admin = new AuthedAdmin(vaultAdmin({
            providers: {
                chyarologin: { identifier: 'admin@example.com', data: { email: 'admin@example.com', discordId: null } },
                discord: { id: '272800190639898628', identifier: 'discord:272800190639898628', data: {} },
            },
        }));

        expect(admin.chyaroLinked).toBe(true);
        expect(admin.discordIdentifier).toBeUndefined();
    });

    test('exposes a validated account accent to web and game sessions', () => {
        vi.stubGlobal('txCore', { cacheStore: { get: vi.fn() } });
        const admin = new AuthedAdmin(vaultAdmin({ preferences: { accent: 'rose' } }));

        expect(admin.getAuthData()).toMatchObject({ accent: 'rose', accentColor: '#e11d48' });
    });

    test('ignores an unknown stored account accent', () => {
        vi.stubGlobal('txCore', { cacheStore: { get: vi.fn() } });
        const admin = new AuthedAdmin(vaultAdmin({ preferences: { accent: '__proto__' } }));

        expect(admin.getAuthData().accent).toBeUndefined();
        expect(admin.getAuthData().accentColor).toBeUndefined();
    });

    test('ignores inherited object keys stored as an account language', () => {
        vi.stubGlobal('txCore', { cacheStore: { get: vi.fn() } });
        const admin = new AuthedAdmin(vaultAdmin({ preferences: { locale: 'toString' } }));

        expect(admin.getAuthData().locale).toBeUndefined();
    });
});
