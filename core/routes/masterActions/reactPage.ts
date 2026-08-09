const modulename = 'WebServer:MasterActions:ReactPage';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';

export default async function MasterActionsReactPage(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('master', modulename)) {
        return ctx.utils.error(403, 'Only the master account can access Master Actions.');
    }
    if (!ctx.txVars.isWebInterface) {
        return ctx.utils.error(403, 'Master Actions is available through the web panel only.');
    }
    return ctx.utils.serveReactIndex();
}
