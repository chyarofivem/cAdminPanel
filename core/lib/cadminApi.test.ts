import { describe, expect, test } from 'vitest';
import {
    assertCadminReady,
    cadminLicenseIdentifierAliases,
    collectCadminLicenseIdentifiers,
    MAX_CADMIN_ACCOUNT_LICENSES,
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

    test('collects every stored license form for account lookup', () => {
        const license = 'abcdef0123456789abcdef0123456789abcdef01';
        const alternate = '1234567890abcdef1234567890abcdef12345678';
        expect(collectCadminLicenseIdentifiers(license, [
            `license:${license}`,
            `license2:${alternate}`,
            'discord:1234',
        ])).toEqual([`license:${license}`, `license2:${alternate}`]);
    });

    test('expands only ambiguous bare framework license values', () => {
        const license = 'abcdef0123456789abcdef0123456789abcdef01';
        expect(cadminLicenseIdentifierAliases(license)).toEqual([
            `license:${license}`,
            `license2:${license}`,
        ]);
        expect(cadminLicenseIdentifierAliases(`license2:${license}`)).toEqual([`license2:${license}`]);
    });

    test('rejects pathological account identifier fanout', () => {
        const identifiers = Array.from({ length: MAX_CADMIN_ACCOUNT_LICENSES + 1 }, (_, index) => (
            `license:${index.toString(16).padStart(40, '0')}`
        ));
        expect(() => collectCadminLicenseIdentifiers(identifiers[0], identifiers)).toThrow(/stale identifiers/);
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

    test('requires a detected framework before reporting a ready connection', () => {
        expect(() => assertCadminReady({ version: '1.0.0' })).toThrow(/has not detected ESX or Qbox/);
        expect(() => assertCadminReady({ framework: 'other', schema: { checked: true, ok: true } })).toThrow(/has not detected ESX or Qbox/);
        expect(() => assertCadminReady({ framework: 'qbox' })).toThrow(/database readiness/);
        expect(() => assertCadminReady({ framework: 'qbox', schema: { checked: false } })).toThrow(/still preparing/);
        expect(() => assertCadminReady({ framework: 'esx', schema: { checked: true, ok: false } })).toThrow(/prepare its database tables/);
        expect(() => assertCadminReady({
            framework: 'qbox',
            schema: { checked: true, ok: true, missingTables: ['players'] },
        })).toThrow(/players/);
        expect(() => assertCadminReady({
            framework: 'qbox',
            schema: { checked: true, ok: true, missingTables: [] },
        })).not.toThrow();
    });
});
