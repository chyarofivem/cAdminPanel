/*
 * Copyright (c) chyarogroup 2026
 */

/**
 * The Rockstar license that FXServer reports as `license:<40 hex>` (and, for some
 * launchers, `license2:<40 hex>`). The two prefixes are identity aliases of the same
 * bare value, as they are for player records, so an administrator linked to one is
 * matched by either.
 */
const BARE_LICENSE = /^[0-9a-f]{40}$/;

/**
 * Accepts `license:<hex>`, `license2:<hex>` or the bare 40-character value, in any
 * case and with surrounding whitespace. Returns the stored form `license:<lowercase hex>`,
 * or null when the input is not a Rockstar license.
 */
export function normalizeLicenseIdentifier(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    const value = input.trim().toLowerCase();
    const bare = value.replace(/^license2?:/, '');
    return BARE_LICENSE.test(bare) ? `license:${bare}` : null;
}

/**
 * Every identifier a player may present for this license: `license:<hex>` and
 * `license2:<hex>`. Any other identifier is returned alone, trimmed and lowercased.
 */
export function licenseIdentifierAliases(identifier: string): string[] {
    const value = identifier.trim().toLowerCase();
    const match = /^license2?:([0-9a-f]{40})$/.exec(value);
    if (!match) return [value];
    return [`license:${match[1]}`, `license2:${match[1]}`];
}
