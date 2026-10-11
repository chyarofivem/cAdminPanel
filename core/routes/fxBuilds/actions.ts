const modulename = 'WebServer:FxBuildsActions';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { FxBuildsActionResp } from '@shared/fxBuildTypes';
import { txEnv } from '@core/globalData';
import { parseBuildNumber } from '@modules/FxBuilds/state';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

//Reaches players as the restart reason, so it stays plain and unbranded
const RESTART_REASON = 'FXServer build change';


/**
 * Mutations of the FXServer build manager. Master only.
 * Build numbers are parsed into integers here; nothing from the request reaches a path or URL.
 */
export default async function FxBuildsActions(ctx: AuthedCtx) {
    const sendTypedResp = (data: FxBuildsActionResp) => ctx.send(data);
    const action = ctx.params?.action;
    if (typeof action !== 'string') {
        return sendTypedResp({ success: false, error: 'Invalid request.' });
    }
    if (!ctx.admin.isMaster) {
        return sendTypedResp({ success: false, error: 'Only the master account can manage FXServer builds.' });
    }
    if (txCore.fxBuilds.providerManaged) {
        return sendTypedResp({ success: false, error: 'Your hosting provider manages FXServer builds, so they cannot be changed here.' });
    }
    const body = ctx.request.body && typeof ctx.request.body === 'object'
        ? ctx.request.body as Record<string, unknown>
        : {};
    const buildLabel = (build: number | null) => build === null
        ? `the panel build ${txEnv.fxsVersion}`
        : `build ${build}`;

    if (action === 'download') {
        const build = parseBuildNumber(body.build);
        if (build === null) return sendTypedResp({ success: false, error: 'Invalid build number.' });
        const result = await txCore.fxBuilds.startDownload(build);
        if (result.success) ctx.admin.logAction(`Downloading FXServer build ${build}.`);
        return sendTypedResp(result);

    } else if (action === 'cancel') {
        const result = txCore.fxBuilds.cancelDownload();
        if (result.success) ctx.admin.logAction('Cancelled the FXServer build download.');
        return sendTypedResp(result);

    } else if (action === 'dismiss') {
        return sendTypedResp(txCore.fxBuilds.dismissDownload());

    } else if (action === 'activate') {
        const build = body.build === null ? null : parseBuildNumber(body.build);
        if (build === null && body.build !== null) {
            return sendTypedResp({ success: false, error: 'Invalid build number.' });
        }
        const result = await txCore.fxBuilds.activate(build);
        if (!result.success) return sendTypedResp(result);
        ctx.admin.logAction(`Switched the game server to FXServer ${buildLabel(build)}.`);
        return sendTypedResp(applyRestart(ctx, result, body.restart === true));

    } else if (action === 'rollback') {
        const result = await txCore.fxBuilds.rollback();
        if (!result.success) return sendTypedResp(result);
        ctx.admin.logAction(`Rolled the game server back to FXServer ${buildLabel(txCore.fxBuilds.activeBuild)}.`);
        return sendTypedResp(applyRestart(ctx, result, body.restart === true));

    } else if (action === 'delete') {
        const build = parseBuildNumber(body.build);
        if (build === null) return sendTypedResp({ success: false, error: 'Invalid build number.' });
        const result = await txCore.fxBuilds.deleteBuild(build);
        if (result.success) ctx.admin.logAction(`Deleted FXServer build ${build}.`);
        return sendTypedResp(result);

    } else {
        return sendTypedResp({ success: false, error: 'Unknown action.' });
    }
};


/**
 * Restarts a running server so it picks up the new build. A stopped server is left
 * stopped and uses the build on its next start.
 */
const applyRestart = (
    ctx: AuthedCtx,
    result: Extract<FxBuildsActionResp, { success: true }>,
    restart: boolean,
): FxBuildsActionResp => {
    if (!restart) {
        return { success: true, message: `${result.message} It applies on the next restart.` };
    }
    if (txCore.fxRunner.isIdle) {
        return { success: true, message: `${result.message} The server is stopped and uses it on its next start.` };
    }
    //Not awaited: the shutdown notice delay can outlast the request
    txCore.fxRunner.restartServer(RESTART_REASON, ctx.admin.name).then((error) => {
        if (error) console.error(`Could not restart the server on the new FXServer build: ${error}`);
    }).catch(() => { });
    return { success: true, message: `${result.message} The server is restarting.` };
};
