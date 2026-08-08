import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { cadminRequest, normalizeCadminBodyIdentifier, requireCadminPermission } from '@lib/cadminApi';

export default async function CadminInventory(ctx: AuthedCtx) {
    if (!requireCadminPermission(ctx, ctx.method === 'GET' ? 'cadmin.players.view' : 'cadmin.inventory.give')) return;
    try {
        const data = ctx.method === 'GET'
            ? await cadminRequest('GET', '/inventory/items')
            : await cadminRequest('POST', '/inventory/give', { body: normalizeCadminBodyIdentifier(ctx.request.body) });
        if (ctx.method !== 'GET') ctx.admin.logAction(`cadmin: gave item to ${ctx.request.body?.identifier}.`);
        return ctx.send({ success: true, data });
    } catch (error) { return ctx.send({ success: false, error: (error as Error).message }); }
}
