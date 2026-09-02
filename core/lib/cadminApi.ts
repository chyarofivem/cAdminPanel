import got from '@lib/got';
import consts from '@shared/consts';

type RequestOptions = {
    query?: Record<string, string>;
    body?: unknown;
};

type CadminPingPayload = {
    framework?: unknown;
    schema?: unknown;
};

export const MAX_CADMIN_ACCOUNT_LICENSES = 16;

/**
 * txAdmin stores the primary license value without its identifier prefix,
 * while FiveM frameworks and the cadminpanel resource store the complete
 * `license:<hex>` identifier. Accept either representation at the panel API
 * boundary and only ever send the complete representation to the game server.
 */
export function normalizeCadminLicenseIdentifier(value: unknown): string {
    if (typeof value !== 'string') throw new Error('That is not a FiveM license identifier.');
    const normalized = value.trim().toLowerCase();
    if (consts.validIdentifiers.license.test(normalized)
        || consts.validIdentifiers.license2.test(normalized)) return normalized;
    if (consts.validIdentifierParts.license.test(normalized)) return `license:${normalized}`;
    throw new Error('That is not a FiveM license identifier.');
}

/**
 * A bare framework database value does not say whether it originated as a
 * license or license2 identifier. Try both exact txAdmin identifier forms when
 * reverse-resolving it, while keeping explicitly prefixed values exact.
 */
export function cadminLicenseIdentifierAliases(value: unknown): string[] {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (consts.validIdentifierParts.license.test(normalized)) {
            return [`license:${normalized}`, `license2:${normalized}`];
        }
    }
    return [normalizeCadminLicenseIdentifier(value)];
}

export function collectCadminLicenseIdentifiers(primary: unknown, identifiers: unknown): string[] {
    const candidates = [primary, ...(Array.isArray(identifiers) ? identifiers : [])];
    const normalized = new Set<string>();
    for (const candidate of candidates) {
        try { normalized.add(normalizeCadminLicenseIdentifier(candidate)); }
        catch { /* Ignore unrelated txAdmin identifiers such as Discord or Steam. */ }
    }
    if (!normalized.size) throw new Error('That is not a FiveM license identifier.');
    if (normalized.size > MAX_CADMIN_ACCOUNT_LICENSES) {
        throw new Error(
            `This player record has more than ${MAX_CADMIN_ACCOUNT_LICENSES} FiveM license identifiers. Remove stale identifiers before using Character Management.`,
        );
    }
    return [...normalized];
}

/**
 * Framework character identifiers are opaque and case-sensitive. Qbox sends a
 * citizenid while ESX sends users.identifier, including multichar prefixes.
 * Validate only the transport constraints instead of pretending this is a
 * FiveM license and accidentally collapsing several characters into one.
 */
export function normalizeCadminCharacterIdentifier(value: unknown): string {
    if (typeof value !== 'string') throw new Error('That is not a valid character identifier.');
    const normalized = value.trim();
    if (!normalized || normalized.length > 128 || /[\u0000-\u001f\u007f/?#]/.test(normalized)) {
        throw new Error('That is not a valid character identifier.');
    }
    return normalized;
}

export function normalizeCadminBodyIdentifier(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error('No identifier given.');
    }
    const requestBody = body as Record<string, unknown>;
    return {
        ...requestBody,
        identifier: normalizeCadminCharacterIdentifier(requestBody.identifier),
    };
}

/**
 * A reachable HTTP handler is only the first half of a useful connection. The
 * resource deliberately answers /ping while its framework bridge is starting,
 * so the settings test must also confirm that character requests can run.
 */
export function assertCadminReady(payload: unknown): asserts payload is CadminPingPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('The cadminpanel resource returned an invalid status response.');
    }
    const ping = payload as CadminPingPayload;
    if (ping.framework !== 'esx' && ping.framework !== 'qbox') {
        throw new Error('cadminpanel is reachable but has not detected ESX or Qbox. Check the FXServer console.');
    }
    if (!ping.schema || typeof ping.schema !== 'object' || Array.isArray(ping.schema)) {
        throw new Error('cadminpanel did not report its database readiness. Update or reinstall the resource.');
    }

    const schema = ping.schema as Record<string, unknown>;
    if (schema.checked !== true) {
        throw new Error('cadminpanel is still preparing its database. Try the connection test again in a moment.');
    }
    if (schema.ok !== true) {
        throw new Error('cadminpanel could not prepare its database tables. Check the FXServer console.');
    }
    const missingTables = Array.isArray(schema.missingTables)
        ? schema.missingTables.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        : [];
    if (missingTables.length) {
        throw new Error(`cadminpanel cannot find the required database tables: ${missingTables.join(', ')}.`);
    }
}

export async function cadminRequest<T = unknown>(method: 'GET' | 'POST', endpoint: string, options: RequestOptions = {}) {
    if (!txConfig.cadmin.enabled) throw new Error('Character Management is disabled.');
    if (!txConfig.cadmin.apiUrl || !txConfig.cadmin.apiSecret) throw new Error('Character Management is not configured.');
    const url = `${txConfig.cadmin.apiUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
    const response = await got(url, {
        method,
        headers: { 'X-Cadmin-Secret': txConfig.cadmin.apiSecret, accept: 'application/json' },
        searchParams: options.query,
        json: method === 'POST' ? options.body ?? {} : undefined,
        timeout: { request: 8000 },
        throwHttpErrors: false,
    });
    let payload: any;
    try {
        payload = JSON.parse(response.body);
    } catch {
        throw new Error(`The game server returned an invalid response (HTTP ${response.statusCode}).`);
    }
    if (response.statusCode < 200 || response.statusCode >= 300 || payload?.ok !== true) {
        throw new Error(payload?.error || `Character Management request failed (HTTP ${response.statusCode}).`);
    }
    return payload.data as T;
}

export const requireCadminPermission = (ctx: any, permission: string) => {
    if (!ctx.admin.testPermission(permission, 'WebServer:Cadmin')) {
        ctx.status = 403;
        ctx.send({ error: 'You do not have permission to perform this Character Management action.' });
        return false;
    }
    return true;
};
