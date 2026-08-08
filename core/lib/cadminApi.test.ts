import { describe, expect, test } from 'vitest';
import {
    normalizeCadminBodyIdentifier,
    normalizeCadminCharacterIdentifier,
    normalizeCadminLicenseIdentifier,
} from './cadminApi';

describe('cAdmin identifier boundaries', () => {
    test('normalizes account licenses without treating them as character keys', () => {
        const license = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
        expect(normalizeCadminLicenseIdentifier(license)).toBe(`license:${license.toLowerCase()}`);
        expect(normalizeCadminLicenseIdentifier(`license2:${license}`)).toBe(`license2:${license.toLowerCase()}`);
        expect(() => normalizeCadminLicenseIdentifier('ABCDEF')).toThrow(/FiveM license/);
        expect(() => normalizeCadminLicenseIdentifier('QBX12345')).toThrow(/FiveM license/);
    });

    test('keeps opaque character keys case-sensitive', () => {
        expect(normalizeCadminCharacterIdentifier('  QBX12AbC  ')).toBe('QBX12AbC');
        expect(normalizeCadminCharacterIdentifier('char1:license:abcdef')).toBe('char1:license:abcdef');
    });

    test('rejects character keys that cannot be transported as one route segment', () => {
        expect(() => normalizeCadminCharacterIdentifier('one/two')).toThrow(/character identifier/);
        expect(() => normalizeCadminCharacterIdentifier('bad\nkey')).toThrow(/character identifier/);
        expect(() => normalizeCadminCharacterIdentifier('')).toThrow(/character identifier/);
    });

    test('normalizes mutation bodies with the character contract', () => {
        expect(normalizeCadminBodyIdentifier({ identifier: 'QBX12AbC', amount: 5 })).toEqual({
            identifier: 'QBX12AbC',
            amount: 5,
        });
    });
});
