import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { UpdateSetupDataResp } from '@shared/updateSetupApiTypes';
import { getUpdateSetupData, isUpdateSetupPending } from '@lib/updateSetup';

export default function UpdateSetupDataRoute(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('master', 'WebServer:UpdateSetupData')) {
        return ctx.send<UpdateSetupDataResp>({ error: 'Only the master account can review updates.' });
    }
    if (!isUpdateSetupPending(true)) {
        return ctx.send<UpdateSetupDataResp>({ error: 'This version has already been acknowledged.' });
    }
    return ctx.send<UpdateSetupDataResp>(getUpdateSetupData());
}
