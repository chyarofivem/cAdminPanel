import type { InitializedCtx } from '@modules/WebServer/ctxTypes';
import { exchangeChyaroCode } from '@lib/chyaroApi';
import { TxConfigState } from '@shared/enums';
import { hasValidChyaroBootstrap } from './chyaroSetup';

const fail = (ctx: InitializedCtx, message: string, redirectPath?: string) => {
    ctx.sessTools.destroy();
    const params = new URLSearchParams({ authError: message });
    if (redirectPath) params.set('r', redirectPath);
    return ctx.redirect(`/login?${params.toString()}`);
};

export default async function ChyaroCallback(ctx: InitializedCtx) {
    const session = ctx.sessTools.get();
    const code = typeof ctx.query.code === 'string' ? ctx.query.code : '';
    const state = typeof ctx.query.state === 'string' ? ctx.query.state : '';
    const redirectPath = session?.tmpChyaroLoginRedirect;
    if (!code || !state || !session?.tmpChyaroLoginState || state !== session.tmpChyaroLoginState) {
        return fail(ctx, 'Invalid or expired chyarologin callback.', redirectPath);
    }

    try {
        const hasAdmins = txCore.adminStore.hasAdmins();
        const bootstrapAuthorized = hasValidChyaroBootstrap(session);
        if (!hasAdmins && !bootstrapAuthorized) {
            return fail(ctx, 'Enter the one-time bootstrap PIN shown in the txAdmin console.', redirectPath);
        }
        const user = await exchangeChyaroCode(code, txConfig.chyaro);
        const vaultAdmin = await txCore.adminStore.resolveChyaroUser(user, bootstrapAuthorized);
        if (!vaultAdmin) return fail(ctx, 'This chyarologin account is not authorized for this panel.', redirectPath);

        ctx.sessTools.set({
            auth: {
                type: 'chyarologin',
                username: vaultAdmin.name,
                csrfToken: txCore.adminStore.genCsrfToken(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000),
                identifier: user.email.trim().toLowerCase(),
            },
        });
        return ctx.redirect(txManager.configState === TxConfigState.Setup
            ? '/server/setup'
            : redirectPath || '/');
    } catch (error) {
        return fail(ctx, (error as Error).message || 'chyarologin failed.', redirectPath);
    }
}
