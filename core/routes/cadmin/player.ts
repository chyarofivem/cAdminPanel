import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import {
    cadminRequest,
    normalizeCadminCharacterIdentifier,
    normalizeCadminLicenseIdentifier,
    requireCadminPermission,
} from '@lib/cadminApi';
import { fetchChyaroUsers } from '@lib/chyaroApi';

export default async function CadminPlayer(ctx: AuthedCtx) {
    if (!requireCadminPermission(ctx, 'cadmin.players.view')) return;
    try {
        if (ctx.query.scope === 'player') {
            const playerLicense = normalizeCadminLicenseIdentifier(ctx.params.identifier);
            const response = await cadminRequest<unknown>('GET', `/characters/${encodeURIComponent(playerLicense)}`);
            const characters: any[] = Array.isArray(response) ? response : [];
            try {
                const users = await fetchChyaroUsers();
                const account = users.find(user => {
                    try { return normalizeCadminLicenseIdentifier(user.fivemLicense) === playerLicense; }
                    catch { return false; }
                }) || null;
                for (const character of characters) character.account = account;
            } catch {
                for (const character of characters) character.account = null;
            }
            return ctx.send({ success: true, data: characters });
        }

        const identifier = normalizeCadminCharacterIdentifier(ctx.params.identifier);
        const data: any = await cadminRequest('GET', `/player/${encodeURIComponent(identifier)}`);
        try {
            const users = await fetchChyaroUsers();
            const playerLicense = typeof data.playerLicense === 'string'
                ? normalizeCadminLicenseIdentifier(data.playerLicense)
                : null;
            data.account = playerLicense
                ? users.find(user => {
                    try { return normalizeCadminLicenseIdentifier(user.fivemLicense) === playerLicense; }
                    catch { return false; }
                }) || null
                : null;
        } catch {
            data.account = null;
        }
        if (!ctx.admin.hasPermission('cadmin.garage.view')) delete data.vehicles;
        return ctx.send({ success: true, data });
    }
    catch (error) { return ctx.send({ success: false, error: (error as Error).message }); }
}
