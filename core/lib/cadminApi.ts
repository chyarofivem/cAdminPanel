import got from '@lib/got';
import consts from '@shared/consts';

type RequestOptions = {
    query?: Record<string, string>;
    body?: unknown;
};

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
