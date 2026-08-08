import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import {
    cadminRequest,
    normalizeCadminBodyIdentifier,
    normalizeCadminCharacterIdentifier,
    requireCadminPermission,
} from '@lib/cadminApi';

export default async function CadminGarage(ctx: AuthedCtx) {
    const isRead = ctx.method === 'GET';
    if (!requireCadminPermission(ctx, isRead ? 'cadmin.garage.view' : 'cadmin.garage.manage')) return;
    try {
        const data = isRead
            ? await cadminRequest('GET', `/garage/${encodeURIComponent(normalizeCadminCharacterIdentifier(ctx.params.identifier))}`)
            : await cadminRequest('POST', '/garage/vehicle', { body: normalizeCadminBodyIdentifier(ctx.request.body) });
        if (!isRead) ctx.admin.logAction(`cadmin: garage ${ctx.request.body?.action} for ${ctx.request.body?.identifier}.`);
        return ctx.send({ success: true, data });
    } catch (error) { return ctx.send({ success: false, error: (error as Error).message }); }
}
