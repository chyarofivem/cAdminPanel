import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { cadminRequest, normalizeCadminBodyIdentifier, requireCadminPermission } from '@lib/cadminApi';

export default async function CadminJob(ctx: AuthedCtx) {
    if (!requireCadminPermission(ctx, 'cadmin.job.set')) return;
    try {
        const data = await cadminRequest('POST', '/job', { body: normalizeCadminBodyIdentifier(ctx.request.body) });
        ctx.admin.logAction(`cadmin: set job for ${ctx.request.body?.identifier}.`);
        return ctx.send({ success: true, data });
    } catch (error) { return ctx.send({ success: false, error: (error as Error).message }); }
}
