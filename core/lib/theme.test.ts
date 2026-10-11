import { describe, expect, it } from 'vitest';
import { ACCENT_PRESETS, accentFillHex, accentOptions, accentVars, isValidAccent, resolveAccent } from './theme';
import { contrastRatio } from '@shared/accent';

describe('theme accents', () => {
    it('ships the seventeen Tailwind presets with blue first', () => {
        const ids = accentOptions().map(option => option.id);
        expect(ids).toHaveLength(17);
        expect(ids[0]).toBe('blue');
        expect(ids).toEqual(Object.keys(ACCENT_PRESETS));
        expect(ids).not.toContain('slate');
        expect(ids).not.toContain('zinc');
    });

    it('falls back to blue for unknown values', () => {
        expect(resolveAccent('not-an-accent')).toBe('blue');
        expect(resolveAccent(undefined)).toBe('blue');
        expect(resolveAccent('__proto__')).toBe('blue');
        expect(resolveAccent('#12345')).toBe('blue');
    });

    it('accepts custom colours as lowercase hex', () => {
        expect(isValidAccent('#FF8800')).toBe(true);
        expect(resolveAccent('#FF8800')).toBe('#ff8800');
        expect(isValidAccent('rgb(1, 2, 3)')).toBe(false);
    });

    it('exposes all seven accent tokens', () => {
        expect(Object.keys(accentVars('emerald'))).toEqual([
            'accent', 'accent-hover', 'accent-text', 'accent-glow',
            'accent-soft', 'accent-tint', 'accent-edge',
        ]);
        expect(accentVars('emerald')['accent']).toBe('#047857');
    });

    it('emits only values the embedded game browser understands', () => {
        for (const value of [...Object.values(accentVars('emerald')), ...Object.values(accentVars('#ffeb3b'))]) {
            expect(value).toMatch(/^(#[0-9a-f]{6}|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 0\.\d+\))$/);
        }
    });

    it('darkens a light custom colour until white text reads at 4.5:1', () => {
        for (const custom of ['#ffeb3b', '#00ff00', '#87ceeb', '#ffffff']) {
            const fill = accentFillHex(custom);
            expect(contrastRatio('#ffffff', fill)).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(accentVars(custom)['accent-text'], '#1c1e23')).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('keeps preset text readable on the sidebar', () => {
        for (const option of accentOptions()) {
            expect(contrastRatio(option.vars['accent-text'], '#1c1e23')).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio('#ffffff', option.fill)).toBeGreaterThanOrEqual(4.5);
        }
    });
});
