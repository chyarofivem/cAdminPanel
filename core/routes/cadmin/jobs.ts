import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { cadminRequest, requireCadminPermission } from '@lib/cadminApi';

export default async function CadminJobs(ctx: AuthedCtx) {
    if (!requireCadminPermission(ctx, 'cadmin.players.view')) return;
    try { return ctx.send({ success: true, data: await cadminRequest('GET', '/jobs') }); }
    catch (error) { return ctx.send({ success: false, error: (error as Error).message }); }
}
