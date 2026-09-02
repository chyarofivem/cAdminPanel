import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import {
    cadminLicenseIdentifierAliases,
    cadminRequest,
    collectCadminLicenseIdentifiers,
    normalizeCadminCharacterIdentifier,
    normalizeCadminLicenseIdentifier,
    requireCadminPermission,
} from '@lib/cadminApi';
import { findPlayersByIdentifier } from '@lib/player/playerFinder';
import playerResolver from '@lib/player/playerResolver';

const LOOKUP_CONCURRENCY = 4;

/**
 * Resolve a framework account identifier back to its txAdmin player record.
 * Qbox and ESX tables may store license2, or an unprefixed value, while txAdmin
 * keys the player record by the primary license. Ambiguous associations are
 * rejected instead of merging two player accounts' character sets.
 */
function resolveAccountLicenses(identifier: unknown): string[] {
    const normalized = normalizeCadminLicenseIdentifier(identifier);
    const matches = new Map<string, ReturnType<typeof playerResolver>>();
    const addMatch = (player: ReturnType<typeof playerResolver>) => {
        if (typeof player.license === 'string') matches.set(player.license, player);
    };

    for (const alias of cadminLicenseIdentifierAliases(identifier)) {
        try {
            for (const player of findPlayersByIdentifier(alias)) addMatch(player);
        } catch { /* The framework lookup can still serve records absent from txAdmin. */ }
    }
    try {
        addMatch(playerResolver(undefined, Number.NaN, normalized.replace(/^license2?:/, '')));
    } catch { /* The identifier may belong only to the framework database. */ }

    if (matches.size > 1) {
        throw new Error('That FiveM identifier is associated with more than one player record.');
    }
    const txPlayer = matches.values().next().value;
    return txPlayer
        ? collectCadminLicenseIdentifiers(txPlayer.license, [normalized, ...txPlayer.allIdentifiers])
        : [normalized];
}

async function fetchCharacters(accountLicenses: string[]): Promise<unknown[]> {
    const responses: unknown[] = [];
    for (let offset = 0; offset < accountLicenses.length; offset += LOOKUP_CONCURRENCY) {
        const batch = accountLicenses.slice(offset, offset + LOOKUP_CONCURRENCY);
        responses.push(...await Promise.all(batch.map(identifier => (
            cadminRequest<unknown>('GET', `/characters/${encodeURIComponent(identifier)}`)
        ))));
    }
    return responses;
}

export default async function CadminPlayer(ctx: AuthedCtx) {
    if (!requireCadminPermission(ctx, 'cadmin.players.view')) return;
    try {
        if (ctx.query.scope === 'player') {
            const accountLicenses = resolveAccountLicenses(ctx.params.identifier);
            const responses = await fetchCharacters(accountLicenses);
            const characters: any[] = [];
            const seenCharacterIds = new Set<string>();
            for (const response of responses) {
                if (!Array.isArray(response)) continue;
                for (const character of response) {
                    const characterId = character?.characterId ?? character?.citizenid ?? character?.identifier;
                    if (typeof characterId === 'string' && seenCharacterIds.has(characterId)) continue;
                    if (typeof characterId === 'string') seenCharacterIds.add(characterId);
                    characters.push(character);
                }
            }
            return ctx.send({ success: true, data: characters });
        }

        const identifier = normalizeCadminCharacterIdentifier(ctx.params.identifier);
        const data: any = await cadminRequest('GET', `/player/${encodeURIComponent(identifier)}`);
        if (!ctx.admin.hasPermission('cadmin.garage.view')) delete data.vehicles;
        return ctx.send({ success: true, data });
    }
    catch (error) { return ctx.send({ success: false, error: (error as Error).message }); }
}
