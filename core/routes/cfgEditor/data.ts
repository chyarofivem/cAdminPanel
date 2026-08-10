const modulename = 'WebServer:CFGEditorData';
import path from 'node:path';
import { readRawCFGFile, resolveCFGFilePath } from '@lib/fxserver/fxsConfigHelper';
import consoleFactory from '@lib/console';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
const console = consoleFactory(modulename);

type CfgEditorDataResponse = {
    success: true;
    data: {
        contents: string;
        fileName: string;
    };
} | {
    success: false;
    error: 'permission_denied' | 'not_configured' | 'read_failed';
};

/**
 * Returns the active CFG contents for the React editor.
 * This endpoint deliberately repeats the master boundary enforced by the React route.
 */
export default async function CFGEditorData(ctx: AuthedCtx) {
    const sendTyped = (response: CfgEditorDataResponse) => ctx.send(response);
    if (!ctx.admin.testPermission('master', modulename)) {
        return sendTyped({ success: false, error: 'permission_denied' });
    }
    const serverDataPath = txConfig.server.dataPath;
    if (!txCore.fxRunner.isConfigured || !serverDataPath) {
        return sendTyped({ success: false, error: 'not_configured' });
    }

    try {
        const cfgFilePath = resolveCFGFilePath(txConfig.server.cfgPath, serverDataPath);
        return sendTyped({
            success: true,
            data: {
                contents: await readRawCFGFile(cfgFilePath),
                fileName: path.basename(cfgFilePath),
            },
        });
    } catch (error) {
        console.error(`Failed to read the configured CFG file: ${(error as Error).message}`);
        return sendTyped({ success: false, error: 'read_failed' });
    }
}
