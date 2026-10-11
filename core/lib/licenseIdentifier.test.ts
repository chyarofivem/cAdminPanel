import { describe, expect, it } from 'vitest';
import { licenseIdentifierAliases, normalizeLicenseIdentifier } from '@shared/licenseIdentifier';

const hex = 'abcdef0123456789abcdef0123456789abcdef01';

describe('Rockstar license identifiers', () => {
    it('normalises every accepted form to license:<lowercase hex>', () => {
        expect(normalizeLicenseIdentifier(`license:${hex}`)).toBe(`license:${hex}`);
        expect(normalizeLicenseIdentifier(`LICENSE2:${hex.toUpperCase()}`)).toBe(`license:${hex}`);
        expect(normalizeLicenseIdentifier(`  ${hex}  `)).toBe(`license:${hex}`);
    });

    it('rejects anything else', () => {
        expect(normalizeLicenseIdentifier('license:1234')).toBeNull();
        expect(normalizeLicenseIdentifier(`steam:${hex}`)).toBeNull();
        expect(normalizeLicenseIdentifier(`license:${hex}0`)).toBeNull();
        expect(normalizeLicenseIdentifier(undefined)).toBeNull();
    });

    it('expands a license into both prefixes and leaves other identifiers alone', () => {
        expect(licenseIdentifierAliases(`license2:${hex}`)).toEqual([`license:${hex}`, `license2:${hex}`]);
        expect(licenseIdentifierAliases('Discord:123')).toEqual(['discord:123']);
    });
});
