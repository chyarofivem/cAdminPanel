import { describe, expect, it } from 'vitest';
import { chyaroUserSchema } from './chyaroApi';

describe('chyarologin user parsing', () => {
    it('accepts nullable optional profile fields', () => {
        const result = chyaroUserSchema.parse({
            id: 'firebase-user-id',
            email: 'admin@example.com',
            fivemName: null,
            fivemLicense: null,
            discordId: null,
            discordAvatar: null,
            role: 'ignored-by-panel',
        });

        expect(result).toMatchObject({
            id: 'firebase-user-id',
            email: 'admin@example.com',
            fivemName: undefined,
            fivemLicense: undefined,
            discordId: undefined,
            discordAvatar: undefined,
        });
        expect(result).not.toHaveProperty('role');
    });

    it('uses uid when the duplicated profile id is absent', () => {
        expect(chyaroUserSchema.parse({
            uid: 12345,
            email: 'admin@example.com',
        }).id).toBe('12345');
    });

    it('falls back to normalized email for legacy profiles without an id', () => {
        expect(chyaroUserSchema.parse({
            email: '  Admin@Example.com  ',
        }).id).toBe('Admin@Example.com');
    });
});
