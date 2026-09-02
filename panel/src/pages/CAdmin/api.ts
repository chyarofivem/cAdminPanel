import consts from '@shared/consts';

export type CadminResponse<T = unknown> = { success: true; data: T } | { success: false; error: string };

export const CADMIN_API_BASE = '/api/cadmin';

/**
 * txAdmin deliberately stores its primary license without the `license:`
 * identifier prefix. The framework bridge uses the identifier exactly as
 * FiveM exposes it, including that prefix. Keep the conversion at this
 * boundary so UI routes can use the stable, prefix-free txAdmin key while
 * bridge requests always receive a real FiveM identifier.
 */
export function toCadminLicenseIdentifier(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (consts.validIdentifiers.license.test(normalized)
        || consts.validIdentifiers.license2.test(normalized)) return normalized;
    if (consts.validIdentifierParts.license.test(normalized)) return `license:${normalized}`;
    return null;
}

export function toTxAdminLicense(value: string | null | undefined): string | null {
    const identifier = toCadminLicenseIdentifier(value);
    return identifier ? identifier.replace(/^license2?:/, '') : null;
}

export function cadminApiPath(path: string): string {
    return `${CADMIN_API_BASE}/${path.replace(/^\/+/, '')}`;
}

/**
 * Whether the Character Management UI should be reachable at all.
 * The framework bridge only supports es_extended and qbx_core, both FiveM-only,
 * so the feature can never work on RedM. The game name comes from the last
 * FXServer boot, so an unknown game keeps the feature visible.
 * NOTE: this must not be used to decide whether toggling the setting requires a
 * page reload, as that comparison needs the raw injected value.
 */
export function isCadminAvailable(): boolean {
    return window.txConsts.cadminEnabled && window.txConsts.server.game !== 'redm';
}

export function cadminCharacterIdentifier(player: CadminPlayer): string {
    return player.characterId || player.citizenid || player.identifier;
}

export type CadminPlayer = {
    /** Compatibility alias for characterId. Never use it for account matching. */
    identifier: string;
    /** Opaque framework character key. Qbox uses citizenid. */
    characterId?: string;
    /** Account-level FiveM identifier used to associate this character to txAdmin. */
    playerLicense?: string;
    /** Compatibility field returned by the current Qbox bridge. */
    citizenid?: string;
    name?: string;
    online?: boolean;
    source?: number;
    group?: string;
    job?: { name?: string; label?: string; grade?: number };
    money?: { cash?: number; bank?: number; dirty?: number };
    inventory?: any[];
    vehicles?: any[];
    pendingItems?: number;
};

export function cadminData<T>(response: CadminResponse<T>): T {
    if (!response.success) throw new Error(response.error);
    return response.data;
}
