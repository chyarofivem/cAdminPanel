const modulename = 'WebServer:AuthBootstrapMaster';
import { z } from 'zod';
import { txEnv } from '@core/globalData';
import consts from '@shared/consts';
import { AuthedAdmin, PassSessAuthType } from '@modules/WebServer/authLogic';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import type { ApiVerifyPasswordResp, ReactAuthDataType } from '@shared/authApiTypes';
const console = consoleFactory(modulename);

const bodySchema = z.object({
    pin: z.string().min(1).max(64),
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(256),
});
export type ApiBootstrapMasterReqSchema = z.infer<typeof bodySchema>;

//NOTE: this desc misses that it should start and end with alphanum or _, and cannot have repeated -_.
const nameRegexDesc = '3 to 20 characters containing only letters, numbers and the characters `_.-`';

/**
 * Creates the first master account, authorized by the one-time PIN printed on
 * the server console, and signs it in right away.
 */
export default async function AuthBootstrapMaster(ctx: InitializedCtx) {
    const uiVersion = typeof ctx.query.uiVersion === 'string' ? ctx.query.uiVersion : undefined;
    if (uiVersion && uiVersion !== txEnv.txaVersion) {
        return ctx.send<ApiVerifyPasswordResp>({ error: 'refreshToUpdate' });
    }

    const parsed = bodySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
        return ctx.send<ApiVerifyPasswordResp>({ error: 'Enter the console PIN, a username and a password.' });
    }
    const { pin, username, password } = parsed.data;

    //Only usable while there is no account to sign in with
    if (txCore.adminStore.hasAdmins()) {
        return ctx.send<ApiVerifyPasswordResp>({
            error: 'The master account already exists, sign in with its username and password.',
        });
    }
    if (!txCore.adminStore.validateAddMasterPin(pin)) {
        console.warn(`Wrong master PIN from: ${ctx.ip}`);
        return ctx.send<ApiVerifyPasswordResp>({
            error: 'Wrong PIN. Check the server console for the current one.',
        });
    }

    //Validating the credentials before touching admins.json, since it can only be created once
    if (!consts.regexValidFivemUsername.test(username)) {
        return ctx.send<ApiVerifyPasswordResp>({ error: `Invalid username, it must have ${nameRegexDesc}.` });
    }
    if (password.trim() !== password) {
        return ctx.send<ApiVerifyPasswordResp>({
            error: 'Your password starts or ends with a space. Remove it and try again.',
        });
    }
    if (password.length < consts.adminPasswordMinLength || password.length > consts.adminPasswordMaxLength) {
        return ctx.send<ApiVerifyPasswordResp>({
            error: `Password must be between ${consts.adminPasswordMinLength} and ${consts.adminPasswordMaxLength} characters.`,
        });
    }

    try {
        const vaultAdmin = txCore.adminStore.createAdminsFile(username, undefined, undefined, password, true, false);
        const sessData = {
            type: 'password',
            username: vaultAdmin.name,
            password_hash: vaultAdmin.password_hash,
            expiresAt: false,
            csrfToken: txCore.adminStore.genCsrfToken(),
        } satisfies PassSessAuthType;
        ctx.sessTools.set({ auth: sessData });

        const authedAdmin = new AuthedAdmin(vaultAdmin, sessData.csrfToken);
        authedAdmin.logAction(`created the master account from ${ctx.ip}`);
        txCore.metrics.txRuntime.loginOrigins.count(ctx.txVars.hostType);
        txCore.metrics.txRuntime.loginMethods.count('password');
        return ctx.send<ReactAuthDataType>(authedAdmin.getAuthData());
    } catch (error) {
        console.warn(`Failed to create the master account: ${(error as Error).message}`);
        console.verbose.dir(error);
        return ctx.send<ApiVerifyPasswordResp>({ error: (error as Error).message });
    }
}
