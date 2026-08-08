const modulename = 'WebServer:CFGEditorSave';
import { validateModifyServerConfig } from '@lib/fxserver/fxsConfigHelper';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);


const isUndefined = (x) => (x === undefined);


/**
 * Saves the server.cfg
 * @param {import('@modules/WebServer/ctxTypes').AuthedCtx} ctx
 */
export default async function CFGEditorSave(ctx) {
    //Sanity check
    if (
        isUndefined(ctx.request.body.cfgData)
        || typeof ctx.request.body.cfgData !== 'string'
    ) {
        return ctx.utils.error(400, 'Invalid Request');
    }

    //Check permissions
    if (!ctx.admin.testPermission('master', modulename)) {
        return ctx.send({
            type: 'danger',
            code: 'permission_denied',
            message: 'You don\'t have permission to execute this action.',
        });
    }

    //Check if file is set
    if (!txCore.fxRunner.isConfigured) {
        const message = 'CFG or Server Data Path not defined. Configure it in the settings page first.';
        return ctx.send({type: 'danger', code: 'not_configured', message});
    }


    //Validating config contents + saving file and backup
    let result;
    try {
        result = await validateModifyServerConfig(
            ctx.request.body.cfgData,
            txConfig.server.cfgPath,
            txConfig.server.dataPath,
        );
    } catch (error) {
        return ctx.send({
            type: 'danger',
            code: 'save_failed',
            details: error.message,
            markdown: true,
            message: `**Failed to save \`server.cfg\` with error:**\n${error.message}`,
        });
    }

    //Handle result
    if (result.errors) {
        return ctx.send({
            type: 'danger',
            code: 'validation_errors',
            details: result.errors,
            markdown: true,
            message: `**Cannot save \`server.cfg\` due to error(s) in your config file(s):**\n${result.errors}`,
        });
    }
    if (result.warnings) {
        return ctx.send({
            type: 'warning',
            code: 'saved_with_warnings',
            details: result.warnings,
            markdown: true,
            message: `**File saved, but there are warnings you should pay attention to:**\n${result.warnings}`,
        });
    }
    return ctx.send({
        type: 'success',
        code: 'saved',
        markdown: true,
        message: '**File saved.**',
    });
};
