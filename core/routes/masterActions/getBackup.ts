const modulename = 'WebServer:MasterActions:GetBackup';
import fsp from 'node:fs/promises';
import consoleFactory from '@lib/console';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { getTimeFilename } from '@lib/misc';
import { txEnv } from '@core/globalData';
const console = consoleFactory(modulename);


/**
 * Handles the rendering or delivery of master action resources
 */
export default async function MasterActionsGet(ctx: AuthedCtx) {
    //Check permissions
    if (!ctx.admin.testPermission('master', modulename)) {
        return ctx.utils.error(403, 'Only the master account can download a database backup.');
    }
    if (!ctx.txVars.isWebInterface) {
        return ctx.utils.error(400, 'Database backups must be downloaded from the web panel.');
    }

    const dbPath = `${txEnv.profilePath}/data/playersDB.json`;
    let readFile;
    try {
        readFile = await fsp.readFile(dbPath);
    } catch (error) {
        console.error(`Could not read database file ${dbPath}.`);
        return ctx.utils.error(500, `Failed to generate the backup: ${(error as Error).message}`);
    }
    //getTimeFilename
    ctx.attachment(`playersDB_${getTimeFilename()}.json`);
    ctx.body = readFile;
    console.log(`[${ctx.admin.name}] Downloading player database.`);
};
