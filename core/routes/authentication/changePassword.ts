const modulename = 'WebServer:AuthChangePassword';
import { z } from 'zod';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import consts from '@shared/consts';
import type { GenericApiResp } from '@shared/genericApiTypes';
const console = consoleFactory(modulename);

const bodySchema = z.object({
    oldPassword: z.string().optional(),
    newPassword: z.string(),
});
export type ApiChangePasswordReqSchema = z.infer<typeof bodySchema>;

/** Set or change the currently authenticated administrator's local password. */
export default async function AuthChangePassword(ctx: AuthedCtx) {
    const parsed = bodySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
        return ctx.send<GenericApiResp>({ error: 'Invalid request body.' });
    }
    const { newPassword, oldPassword } = parsed.data;
    if (newPassword.trim() !== newPassword) {
        return ctx.send<GenericApiResp>({
            error: 'Your new password starts or ends with a space. Remove it and try again.',
        });
    }
    if (newPassword.length < consts.adminPasswordMinLength || newPassword.length > consts.adminPasswordMaxLength) {
        return ctx.send<GenericApiResp>({
            error: `Password must be between ${consts.adminPasswordMinLength} and ${consts.adminPasswordMaxLength} characters.`,
        });
    }

    const vaultAdmin = txCore.adminStore.getAdminByName(ctx.admin.name);
    if (!vaultAdmin) throw new Error('Authenticated admin is no longer present in AdminStore.');
    const currentSession = ctx.sessTools.get();
    if (!ctx.admin.isTempPassword && (!oldPassword || !VerifyPasswordHash(oldPassword, vaultAdmin.password_hash))) {
        return ctx.send<GenericApiResp>({ error: 'Wrong current password.' });
    }

    try {
        const newHash = await txCore.adminStore.setAdminPassword(ctx.admin.name, newPassword, false);
        if (currentSession?.auth?.type === 'password') {
            ctx.sessTools.set({
                auth: {
                    ...currentSession.auth,
                    password_hash: newHash,
                },
            });
        }
        ctx.admin.logAction('Changing own local password.');
        return ctx.send<GenericApiResp>({ success: true });
    } catch (error) {
        console.verbose.warn(`Failed to change password for '${ctx.admin.name}': ${(error as Error).message}`);
        return ctx.send<GenericApiResp>({ error: (error as Error).message });
    }
}
