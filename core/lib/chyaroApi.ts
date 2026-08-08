import { z } from 'zod';
import got from '@lib/got';

const identityValue = z.union([z.string(), z.number()]).transform(String);
const nullableString = z.string().nullable().optional().transform(value => value ?? undefined);

export const chyaroUserSchema = z.object({
    // Older profiles can be missing their duplicated Firestore document ID.
    // `uid` is accepted when present, with email as the final stable fallback.
    id: identityValue.optional(),
    uid: identityValue.optional(),
    email: z.string().trim().email(),
    fivemName: nullableString,
    fivemLicense: nullableString,
    fivemLinked: z.boolean().optional().default(false),
    discordId: identityValue.nullable().optional().transform(value => value ?? undefined),
    discordUsername: nullableString,
    discordAvatar: nullableString,
}).transform(user => ({
    ...user,
    id: user.id ?? user.uid ?? user.email,
}));

export type ChyaroUser = z.infer<typeof chyaroUserSchema>;

type ChyaroConfig = { apiUrl: string; apiKey: string };

const apiHeaders = (apiKey: string) => ({
    authorization: `Bearer ${apiKey}`,
    accept: 'application/json',
});

export async function testChyaroConnection(config: ChyaroConfig) {
    if (!config.apiKey.trim()) throw new Error('The API key is required.');
    const response = await got.get(`${config.apiUrl.replace(/\/+$/, '')}/api/auth/users`, {
        headers: apiHeaders(config.apiKey.trim()),
    }).json<unknown>();
    const users = z.array(chyaroUserSchema).safeParse(response);
    if (!users.success) throw new Error('The identity endpoint returned an unexpected response.');
    return users.data.slice(0, 50).map(user => user.email);
}

async function chyaroRequest(method: 'GET' | 'PUT' | 'POST', path: string, options: { body?: unknown } = {}) {
    const response = await got(`${txConfig.chyaro.apiUrl.replace(/\/+$/, '')}${path}`, {
        method,
        headers: apiHeaders(txConfig.chyaro.apiKey.trim()),
        json: options.body,
        throwHttpErrors: false,
        timeout: { request: 10_000 },
    });
    let payload: any;
    try { payload = response.body ? JSON.parse(response.body) : null; }
    catch { throw new Error(`chyarologin returned an invalid response (HTTP ${response.statusCode}).`); }
    if (response.statusCode < 200 || response.statusCode >= 300 || payload?.success === false) {
        throw new Error(payload?.error || payload?.message || `chyarologin request failed (HTTP ${response.statusCode}).`);
    }
    return payload;
}

export async function fetchChyaroUsers(): Promise<ChyaroUser[]> {
    const payload = await chyaroRequest('GET', '/api/auth/users');
    return z.array(chyaroUserSchema).parse(payload);
}

export async function fetchChyaroUser(id: string) {
    return (await fetchChyaroUsers()).find(user => user.id === id) || null;
}

export async function unlinkChyaroFivem(license: string) {
    return chyaroRequest('POST', '/api/auth/link-fivem', { body: { license, unlink: true } });
}

export async function exchangeChyaroCode(code: string, config: ChyaroConfig): Promise<ChyaroUser> {
    const response = await got.get(`${config.apiUrl.replace(/\/+$/, '')}/api/auth/validate-user`, {
        headers: apiHeaders(config.apiKey.trim()),
        searchParams: { code },
        throwHttpErrors: false,
    });
    let payload: unknown;
    try {
        payload = JSON.parse(response.body);
    } catch {
        throw new Error(`chyarologin returned an invalid response (HTTP ${response.statusCode}).`);
    }
    if (response.statusCode < 200 || response.statusCode >= 300 || (payload as any)?.success === false) {
        throw new Error((payload as any)?.error || (payload as any)?.message
            || `chyarologin rejected the sign-in code (HTTP ${response.statusCode}).`);
    }
    const envelope = z.object({ success: z.literal(true), user: chyaroUserSchema }).safeParse(payload);
    if (!envelope.success) {
        throw new Error('chyarologin returned a user profile with invalid identity fields.');
    }
    return envelope.data.user;
}

export function buildChyaroLoginUrl(apiUrl: string, callbackUri: string, state: string) {
    const loginUrl = new URL(apiUrl.replace(/\/+$/, '') + '/');
    loginUrl.searchParams.set('redirect_uri', callbackUri);
    loginUrl.searchParams.set('state', state);
    loginUrl.searchParams.set('client_id', 'txadmin');
    return loginUrl.toString();
}

export async function linkChyaroFivem(code: string, license: string, name: string) {
    const response = await got.post(`${txConfig.chyaro.apiUrl.replace(/\/+$/, '')}/api/auth/link-fivem`, {
        headers: apiHeaders(txConfig.chyaro.apiKey),
        json: { code, license, name },
        throwHttpErrors: false,
    });
    let payload: any;
    try { payload = JSON.parse(response.body); }
    catch { throw new Error(`chyarologin returned an invalid response (HTTP ${response.statusCode}).`); }
    if (response.statusCode < 200 || response.statusCode >= 300 || payload?.success === false) {
        throw new Error(payload?.error || payload?.message || 'chyarologin rejected the link code.');
    }
    const result = payload?.data ?? payload?.user ?? payload;
    return { email: result?.email ?? '', uid: result?.uid ?? result?.id ?? '' };
}
