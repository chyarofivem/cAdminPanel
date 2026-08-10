import type { PlayersTablePlayerType } from '@shared/playerApiTypes';
import { toTxAdminLicense } from '@/pages/CAdmin/api';

export type PlayerLicenseAliasIndex = Map<string, string | null>;

export function buildPlayerLicenseAliasIndex(players: PlayersTablePlayerType[]) {
    const aliases: PlayerLicenseAliasIndex = new Map();

    for (const player of players) {
        const primaryLicense = toTxAdminLicense(player.license);
        if (!primaryLicense) continue;

        for (const identifier of [player.license, ...player.licenseIdentifiers]) {
            const alias = toTxAdminLicense(identifier);
            if (!alias) continue;
            const current = aliases.get(alias);
            if (current === undefined) {
                aliases.set(alias, primaryLicense);
            } else if (current !== primaryLicense) {
                aliases.set(alias, null);
            }
        }
    }

    return aliases;
}

export function resolveFrameworkPlayerLicense(
    identifier: string | null | undefined,
    aliases: PlayerLicenseAliasIndex,
) {
    const normalized = toTxAdminLicense(identifier);
    if (!normalized) return { license: null, ambiguous: false };

    const mappedLicense = aliases.get(normalized);
    if (mappedLicense === null) return { license: normalized, ambiguous: true };
    return { license: mappedLicense ?? normalized, ambiguous: false };
}
