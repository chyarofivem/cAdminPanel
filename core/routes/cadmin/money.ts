import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { cadminRequest, normalizeCadminBodyIdentifier, requireCadminPermission } from '@lib/cadminApi';

export default async function CadminMoney(ctx: AuthedCtx) {
    const permission = ctx.request.body?.action === 'set' ? 'cadmin.money.set' : 'cadmin.money.give';
    if (!requireCadminPermission(ctx, permission)) return;
    try {
        const data = await cadminRequest('POST', '/money', { body: normalizeCadminBodyIdentifier(ctx.request.body) });
        ctx.admin.logAction(`cadmin: money ${ctx.request.body?.action} ${ctx.request.body?.account} for ${ctx.request.body?.identifier}.`);
        return ctx.send({ success: true, data });
    } catch (error) { return ctx.send({ success: false, error: (error as Error).message }); }
}
