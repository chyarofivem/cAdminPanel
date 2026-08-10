import { describe, expect, it } from 'vitest';
import type { PlayersTablePlayerType } from '@shared/playerApiTypes';
import { buildPlayerLicenseAliasIndex, resolveFrameworkPlayerLicense } from './playerIdentity';

const licenseA = 'a'.repeat(40);
const licenseB = 'b'.repeat(40);
const licenseC = 'c'.repeat(40);

function player(license: string, licenseIdentifiers: string[]): PlayersTablePlayerType {
    return {
        license,
        licenseIdentifiers,
        displayName: license,
        playTime: 0,
        tsJoined: 0,
        tsLastConnection: 0,
        isAdmin: false,
        isOnline: false,
        isWhitelisted: false,
    };
}

describe('player identity aliases', () => {
    it('merges a framework license2 alias into the primary player record', () => {
        const aliases = buildPlayerLicenseAliasIndex([
            player(licenseA, [`license:${licenseA}`, `license2:${licenseB}`]),
        ]);

        expect(resolveFrameworkPlayerLicense(`license2:${licenseB}`, aliases)).toEqual({
            license: licenseA,
            ambiguous: false,
        });
    });

    it('marks an alias shared by two player records as ambiguous', () => {
        const aliases = buildPlayerLicenseAliasIndex([
            player(licenseA, [`license:${licenseA}`, `license2:${licenseC}`]),
            player(licenseB, [`license:${licenseB}`, `license2:${licenseC}`]),
        ]);

        expect(resolveFrameworkPlayerLicense(`license2:${licenseC}`, aliases)).toEqual({
            license: licenseC,
            ambiguous: true,
        });
    });
});
