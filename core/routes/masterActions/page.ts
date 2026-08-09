const modulename = 'WebServer:MasterActions:Page';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Handles the rendering or delivery of master action resources
 */
export default async function MasterActionsPage(ctx: AuthedCtx) {
    const isMasterAdmin = (ctx.admin.hasPermission('master'));
    if (!isMasterAdmin) return ctx.utils.error(403, 'Only the master account can access Master Actions.');
    return ctx.utils.render('main/masterActions', {
        headerTitle: 'Master Actions',
        isMasterAdmin,
        disableActions: (isMasterAdmin && ctx.txVars.isWebInterface) ? '' : 'disabled',
    });
};
