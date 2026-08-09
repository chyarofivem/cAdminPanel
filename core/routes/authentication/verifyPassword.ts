const modulename = 'WebServer:AuthVerifyPassword';
import { z } from 'zod';
import { txEnv } from '@core/globalData';
import { AuthedAdmin, PassSessAuthType } from '@modules/WebServer/authLogic';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import type { ApiVerifyPasswordResp, ReactAuthDataType } from '@shared/authApiTypes';
const console = consoleFactory(modulename);

const bodySchema = z.object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(128),
});
export type ApiVerifyPasswordReqSchema = z.infer<typeof bodySchema>;

/** Authenticate an administrator using the password hash stored in admins.json. */
export default async function AuthVerifyPassword(ctx: InitializedCtx) {
    const uiVersion = typeof ctx.query.uiVersion === 'string' ? ctx.query.uiVersion : undefined;
    if (uiVersion && uiVersion !== txEnv.txaVersion) {
        return ctx.send<ApiVerifyPasswordResp>({ error: 'refreshToUpdate' });
    }

    const parsed = bodySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
        return ctx.send<ApiVerifyPasswordResp>({ error: 'Enter a username and password.' });
    }
    if (!txCore.adminStore.hasAdmins()) {
        return ctx.send<ApiVerifyPasswordResp>({ error: 'no_admins_setup' });
    }

    try {
        const vaultAdmin = txCore.adminStore.getAdminByName(parsed.data.username);
        if (!vaultAdmin || !VerifyPasswordHash(parsed.data.password, vaultAdmin.password_hash)) {
            console.warn(`Wrong username or password from: ${ctx.ip}`);
            return ctx.send<ApiVerifyPasswordResp>({ error: 'Wrong username or password!' });
        }

        const sessData = {
            type: 'password',
            username: vaultAdmin.name,
            password_hash: vaultAdmin.password_hash,
            expiresAt: false,
            csrfToken: txCore.adminStore.genCsrfToken(),
        } satisfies PassSessAuthType;
        ctx.sessTools.set({ auth: sessData });

        const authedAdmin = new AuthedAdmin(vaultAdmin, sessData.csrfToken);
        authedAdmin.logAction(`logged in from ${ctx.ip} via password auth`);
        txCore.metrics.txRuntime.loginOrigins.count(ctx.txVars.hostType);
        txCore.metrics.txRuntime.loginMethods.count('password');
        return ctx.send<ReactAuthDataType>(authedAdmin.getAuthData());
    } catch (error) {
        console.warn(`Failed to authenticate '${parsed.data.username}': ${(error as Error).message}`);
        console.verbose.dir(error);
        return ctx.send<ApiVerifyPasswordResp>({ error: 'Error authenticating admin.' });
    }
}
