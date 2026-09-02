const modulename = 'WebServer:TxAdminLog';
import { z } from 'zod';

import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { TxAdminLogApiResponse } from '@shared/txAdminLogTypes';
import type { GenericApiErrorResp } from '@shared/genericApiTypes';

const querySchema = z.object({
    before: z.string().min(1).max(160).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    channel: z.enum(['action', 'server']).optional(),
    query: z.string().trim().max(160).optional(),
});

export default async function TxAdminLog(ctx: AuthedCtx) {
    const sendTypedResp = (data: TxAdminLogApiResponse | GenericApiErrorResp) => ctx.send(data);
    if (!ctx.admin.testPermission('panel.log.view', modulename)) {
        ctx.status = 403;
        return sendTypedResp({ error: 'You do not have permission to view the panel log.' });
    }

    const parsed = querySchema.safeParse(ctx.query);
    if (!parsed.success) {
        ctx.status = 400;
        return sendTypedResp({ error: 'Invalid panel log query.' });
    }
    return sendTypedResp(txCore.logger.txadmin.query(parsed.data));
}
