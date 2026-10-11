const modulename = 'WebServer:FxBuildsData';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { FxBuildsDataResp } from '@shared/fxBuildTypes';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);


/**
 * Returns the FXServer build manager state. Master only.
 * `?refresh=1` reloads the Cfx.re build lists (at most every 30 seconds).
 */
export default async function FxBuildsData(ctx: AuthedCtx) {
    const sendTypedResp = (data: FxBuildsDataResp) => ctx.send(data);
    if (!ctx.admin.isMaster) {
        return sendTypedResp({
            success: false,
            error: 'Only the master account can manage FXServer builds.',
        });
    }

    try {
        const forceRefresh = ctx.query?.refresh === '1';
        const data = await txCore.fxBuilds.getData(forceRefresh);
        return sendTypedResp({ success: true, data });
    } catch (error) {
        const msg = (error as Error)?.message ?? 'Unknown error';
        console.verbose.error(`Failed to load the FXServer builds data: ${msg}`);
        return sendTypedResp({
            success: false,
            error: 'Could not load the FXServer builds.',
        });
    }
};
