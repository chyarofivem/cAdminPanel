const modulename = 'WebServer:Advanced:Run';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import { z } from 'zod';
import type {
    RunAdvancedCommandReq,
    RunAdvancedCommandResp,
    RunAdvancedCommandRespSuccess,
} from '@shared/advancedCommands';
import txAdminCmds from './groups/txAdminCmds';
import serverCmds from './groups/serverCmds';
import processCmds from './groups/processCmds';
import otherCmds from './groups/otherCmds';
import databaseCmds from './groups/databaseCmds';
const console = consoleFactory(modulename);


//Req validation & types
//NOTE: the response types are declared in shared/ because the panel cannot import
//from core. The satisfies below fails the build if the schema drifts from them.
const bodySchema = z.object({
    cmd: z.string(),
}) satisfies z.ZodType<RunAdvancedCommandReq>;
export type { RunAdvancedCommandReq, RunAdvancedCommandResp, RunAdvancedCommandRespSuccess };


//NOTE: leaving the args splitting to the handler
export type AdvancedCommandHandler = (ctx: AuthedCtx, args: string) => (Promise<RunAdvancedCommandRespSuccess> | RunAdvancedCommandRespSuccess);
const handlers: Record<string, AdvancedCommandHandler> = {
    ...txAdminCmds,
    ...databaseCmds,
    ...serverCmds,
    ...processCmds,
    ...otherCmds,
}


/**
 * Runs an advanced command
 */
export default async function RunAdvancedCommand(ctx: AuthedCtx) {
    const sendTypedResp = (data: RunAdvancedCommandResp) => ctx.send(data);

    //Check permissions
    if (!ctx.admin.testPermission('all_permissions', modulename)) {
        return sendTypedResp({
            error: 'You do not have permission to change the settings.'
        });
    }

    //Validating input
    const schemaRes = bodySchema.safeParse(ctx.request.body);
    if (!schemaRes.success) {
        return sendTypedResp({
            error: `Invalid request body: ${schemaRes.error.message}`,
        });
    }
    const cmdStr = schemaRes.data.cmd;

    //Parsing the command
    const [, cmd, rawArgs] = cmdStr.match(/^(?<cmd>\w+)(?:\s+(?<rawArgs>.*))?$/) || [];
    if (!cmd || !(cmd in handlers) || !handlers[cmd]) {
        return sendTypedResp({
            error: `Invalid command: ${cmdStr}`,
        });
    }

    //Running the command
    const args = rawArgs?.trim() ?? '';
    try {
        const result = await handlers[cmd](ctx, args);
        ctx.admin.logAction(`Ran advanced command: ${cmd} ${args}`);
        return sendTypedResp(result);
    } catch (error) {
        return sendTypedResp({
            error: `Error running command: ${(error as any)?.message ?? 'Unknown error'}`,
        });
    }
};
