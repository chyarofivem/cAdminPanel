import { createHash, timingSafeEqual } from 'node:crypto';
import type { InitializedCtx } from '@modules/WebServer/ctxTypes';
import { linkChyaroFivem } from '@lib/chyaroApi';

const matchesSecret = (provided: string, expected: string) => {
    const left = createHash('sha256').update(provided).digest();
    const right = createHash('sha256').update(expected).digest();
    return !!expected && timingSafeEqual(left, right);
};

export default async function CadminLink(ctx: InitializedCtx) {
    if (!txConfig.cadmin.enabled) {
        ctx.status = 503;
        return ctx.send({ ok: false, error: 'Character Management is disabled.' });
    }
    const provided = typeof ctx.request.headers['x-cadmin-secret'] === 'string'
        ? ctx.request.headers['x-cadmin-secret'] : '';
    if (!matchesSecret(provided, txConfig.cadmin.apiSecret)) {
        ctx.status = 401;
        return ctx.send({ ok: false, error: 'Bad or missing X-Cadmin-Secret.' });
    }
    const { code, license, name } = ctx.request.body ?? {};
    if (typeof code !== 'string' || !/^[A-HJ-NP-Z2-9]{8}$/.test(code)
        || typeof license !== 'string' || !license.startsWith('license:')) {
        ctx.status = 400;
        return ctx.send({ ok: false, error: 'Invalid link request.' });
    }
    try {
        const data = await linkChyaroFivem(code, license, typeof name === 'string' ? name.slice(0, 64) : 'Unknown');
        return ctx.send({ ok: true, data });
    } catch (error) {
        ctx.status = 400;
        return ctx.send({ ok: false, error: (error as Error).message });
    }
}
