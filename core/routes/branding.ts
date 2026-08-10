/*
 * Copyright (c) chyarogroup 2026
 */

import type { InitializedCtx } from '@modules/WebServer/ctxTypes';
import { BRANDING_KINDS, type BrandingKind, readBrandingAsset } from '@lib/branding';

export default async function Branding(ctx: InitializedCtx) {
    const kind = (ctx.params as { kind?: unknown }).kind;
    if (typeof kind !== 'string' || !BRANDING_KINDS.includes(kind as BrandingKind)) {
        return ctx.utils.error(404, 'Branding asset not found.');
    }

    const asset = await readBrandingAsset(kind as BrandingKind, ctx.query.default === '1');
    ctx.type = asset.mime;
    ctx.body = asset.body;
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (asset.mime === 'image/svg+xml') {
        ctx.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }
}
