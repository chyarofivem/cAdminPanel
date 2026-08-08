import { describe, expect, test } from 'vitest';
import { AuthedAdmin } from './authLogic';

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
