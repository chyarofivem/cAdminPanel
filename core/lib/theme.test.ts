import { describe, expect, it } from 'vitest';
import { ACCENTS, accentOptions, accentVars, resolveAccent } from './theme';

describe('theme accents', () => {
    it('ships the twelve configured accents', () => {
        expect(Object.keys(ACCENTS)).toHaveLength(12);
        expect(accentOptions().map(option => option.id)).toEqual(Object.keys(ACCENTS));
    });

    it('falls back to blue for unknown values', () => {
        expect(resolveAccent('not-an-accent')).toBe('blue');
        expect(resolveAccent(undefined)).toBe('blue');
    });

    it('exposes all four role-based colour slots', () => {
        expect(accentVars('emerald')).toEqual({
            'brand-300': ACCENTS.emerald[300],
            'brand-500': ACCENTS.emerald[500],
            'brand-600': ACCENTS.emerald[600],
            'brand-700': ACCENTS.emerald[700],
        });
    });
});
