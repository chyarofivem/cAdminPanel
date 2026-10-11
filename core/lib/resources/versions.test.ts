import { describe, expect, it } from 'vitest';
import { compareResourceVersions, normalizeVersionTag } from './versions';

describe('normalizeVersionTag', () => {
    it('strips whitespace and a leading v before a digit', () => {
        expect(normalizeVersionTag(' v1.2.3 ')).toBe('1.2.3');
        expect(normalizeVersionTag('V2.0')).toBe('2.0');
        expect(normalizeVersionTag('version')).toBe('version');
        expect(normalizeVersionTag(undefined)).toBe('');
    });
});

describe('compareResourceVersions', () => {
    it.each([
        ['1.2.0', '1.3.0', 'newer'],
        ['1.2.0', 'v1.2.1', 'newer'],
        ['1.3.0', 'v1.3.0', 'same'],
        ['2.0.0', '1.9.9', 'older'],
        ['1.0.0-beta.1', '1.0.0', 'newer'],
        ['1.0.0', '1.0.0-rc.1', 'older'],
        ['1.2', '1.2.1', 'newer'],
        ['1.0', '1.0.0', 'same'],
        ['1.2.3.4', '1.2.3.5', 'newer'],
        ['10', '9', 'older'],
        ['1.0.0+build.5', '1.0.0', 'same'],
    ] as const)('%s against %s is %s', (current, latest, expected) => {
        expect(compareResourceVersions(current, latest)).toBe(expected);
    });

    it('reports text that is not a version as unknown', () => {
        expect(compareResourceVersions('', '1.0.0')).toBe('unknown');
        expect(compareResourceVersions('1.0.0', 'latest')).toBe('unknown');
        expect(compareResourceVersions('release-2024', 'release-2025')).toBe('unknown');
        expect(compareResourceVersions(undefined, '1.0.0')).toBe('unknown');
    });

    it('treats identical text as the same version', () => {
        expect(compareResourceVersions('stable', 'Stable')).toBe('same');
    });
});
