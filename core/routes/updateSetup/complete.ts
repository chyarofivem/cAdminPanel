import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { UpdateSetupCompleteResp } from '@shared/updateSetupApiTypes';
import { completeUpdateSetup, isUpdateSetupPending } from '@lib/updateSetup';

export default async function UpdateSetupCompleteRoute(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('master', 'WebServer:UpdateSetupComplete')) {
        return ctx.send<UpdateSetupCompleteResp>({ error: 'Only the master account can complete updates.' });
    }
    if (!isUpdateSetupPending(true)) {
        return ctx.send<UpdateSetupCompleteResp>({ success: true });
    }
    try {
        await completeUpdateSetup(ctx.request.body?.values, ctx.admin.name);
        ctx.admin.logAction('Reviewed the post-update changelog and completed required settings.');
        return ctx.send<UpdateSetupCompleteResp>({ success: true });
    } catch (error) {
        return ctx.send<UpdateSetupCompleteResp>({
            error: error instanceof Error ? error.message : 'Unable to save the update settings.',
        });
    }
}
