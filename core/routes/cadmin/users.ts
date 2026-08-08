import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { fetchChyaroUser, fetchChyaroUsers, unlinkChyaroFivem } from '@lib/chyaroApi';

const modulename = 'WebServer:CadminLinkedAccounts';
const sendError = (ctx: AuthedCtx, error: unknown) => ctx.send({ success: false, error: (error as Error).message });

export async function list(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('master', modulename)) {
        return ctx.send({ success: false, error: 'Only the master account can view linked accounts.' });
    }
    try {
        const users = await fetchChyaroUsers();
        const query = typeof ctx.query.q === 'string' ? ctx.query.q.trim().toLowerCase() : '';
        const filtered = query ? users.filter(user => [
            user.email, user.discordUsername, user.fivemName, user.fivemLicense,
        ].some(value => String(value || '').toLowerCase().includes(query))) : users;
        filtered.sort((a, b) => a.email.localeCompare(b.email));
        return ctx.send({ success: true, data: {
            users: filtered,
            total: users.length,
        } });
    } catch (error) { return sendError(ctx, error); }
}

export async function action(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('master', modulename)) {
        return ctx.send({ success: false, error: 'Only the master account can manage linked accounts.' });
    }
    try {
        if (String(ctx.params.action || '') !== 'unlink') throw new Error('Unknown identity action.');
        const user = await fetchChyaroUser(String(ctx.params.id || ''));
        if (!user) throw new Error('That account no longer exists in chyarologin.');
        if (!user.fivemLicense) throw new Error('That account has no FiveM character linked.');
        await unlinkChyaroFivem(user.fivemLicense);
        ctx.admin.logAction(`cadmin: unlinked ${user.fivemLicense} from ${user.email}.`);
        return ctx.send({ success: true, data: null });
    } catch (error) { return sendError(ctx, error); }
}
