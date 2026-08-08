import { randomUUID } from 'node:crypto';
import type { InitializedCtx } from '@modules/WebServer/ctxTypes';
import { buildChyaroLoginUrl } from '@lib/chyaroApi';
import { txHostConfig } from '@core/globalData';
import { hasValidChyaroBootstrap } from './chyaroSetup';

export const safeLocalRedirect = (value: unknown) => {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return undefined;
    if (value.length > 2048 || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return undefined;
    try {
        const base = new URL('http://txadmin.local');
        const resolved = new URL(value, base);
        return resolved.origin === base.origin ? `${resolved.pathname}${resolved.search}${resolved.hash}` : undefined;
    } catch {
        return undefined;
    }
};

export default async function ChyaroLogin(ctx: InitializedCtx) {
    if (!txConfig.chyaro.apiKey) return ctx.redirect('/login?authError=Configure+chyarologin+first.');
    const session = ctx.sessTools.get();
    if (!txCore.adminStore.hasAdmins() && !hasValidChyaroBootstrap(session)) {
        return ctx.redirect('/login?authError=Enter+the+one-time+bootstrap+PIN+shown+in+the+txAdmin+console.');
    }
    const state = randomUUID();
    const callbackUri = new URL('/auth/chyaro/callback', txHostConfig.txaUrl || ctx.origin).toString();
    const redirectPath = safeLocalRedirect(ctx.query.r);
    ctx.sessTools.set({
        tmpChyaroLoginState: state,
        tmpChyaroLoginCallbackUri: callbackUri,
        tmpChyaroLoginRedirect: redirectPath,
        tmpChyaroBootstrapExpiresAt: session?.tmpChyaroBootstrapExpiresAt,
    });
    return ctx.redirect(buildChyaroLoginUrl(txConfig.chyaro.apiUrl, callbackUri, state));
}
