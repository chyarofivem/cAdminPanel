const modulename = 'WebServer:AuthSelfIdentifiers';
import { z } from 'zod';
import got from '@lib/got';
import consts from '@shared/consts';
import consoleFactory from '@lib/console';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { ApiSelfIdentifiersResp } from '@shared/authApiTypes';
const console = consoleFactory(modulename);

const cfxHttpReqOptions = { timeout: { request: 6000 } };
const bodySchema = z.object({
    cfxIdentifier: z.string(),
    //Omitting this field means "leave Discord untouched". This lets a
    //chyarologin-linked account still update its cfx.re identifier while the
    //server rejects any attempt to manually manage Discord.
    discordIdentifier: z.string().optional(),
});
type ProviderData = { id: string, identifier: string };

export default async function AuthSelfIdentifiers(ctx: AuthedCtx) {
    const parsed = bodySchema.safeParse(ctx.request.body);
    if (!parsed.success) return ctx.utils.error(400, 'Invalid Request - missing parameters');

    const vaultAdmin = txCore.adminStore.getAdminByName(ctx.admin.name);
    if (!vaultAdmin) throw new Error('Authenticated admin is no longer present in AdminStore.');
    const chyaroLinked = !!vaultAdmin.providers?.chyarologin;
    if (chyaroLinked && parsed.data.discordIdentifier !== undefined) {
        return ctx.send<ApiSelfIdentifiersResp>({
            error: 'Discord must be connected or disconnected through chyarologin for this account.',
        });
    }

    const cfxIdentifier = parsed.data.cfxIdentifier.trim();
    const currentCfxIdentifier = vaultAdmin.providers?.citizenfx?.identifier;
    let citizenfxData: ProviderData | false | undefined;
    if (cfxIdentifier === (currentCfxIdentifier ?? '')) {
        citizenfxData = undefined;
    } else if (!cfxIdentifier.length) {
        citizenfxData = false;
    } else {
        try {
            if (consts.validIdentifiers.fivem.test(cfxIdentifier)) {
                const id = cfxIdentifier.split(':')[1];
                const res = await got(`https://policy-live.fivem.net/api/getUserInfo/${id}`, cfxHttpReqOptions).json<any>();
                if (!res.username || !res.username.length) {
                    return ctx.send<ApiSelfIdentifiersResp>({ error: 'This cfx.re identifier does not exist.' });
                }
                citizenfxData = { id: res.username, identifier: cfxIdentifier };
            } else if (consts.regexValidFivemUsername.test(cfxIdentifier)) {
                const res = await got(`https://forum.cfx.re/u/${cfxIdentifier}.json`, cfxHttpReqOptions).json<any>();
                if (!res.user || typeof res.user.id !== 'number') {
                    return ctx.send<ApiSelfIdentifiersResp>({ error: 'This cfx.re username does not exist.' });
                }
                citizenfxData = { id: cfxIdentifier, identifier: `fivem:${res.user.id}` };
            } else {
                return ctx.send<ApiSelfIdentifiersResp>({
                    error: 'Enter either a cfx.re forum username or an identifier in the `fivem:0000` format.',
                });
            }
        } catch (error) {
            console.error(`Failed to resolve cfx.re identifier with error: ${(error as Error).message}`);
            return ctx.send<ApiSelfIdentifiersResp>({
                error: 'Could not reach the cfx.re servers to validate this identifier, please try again.',
            });
        }
    }

    let discordData: ProviderData | false | undefined;
    if (!chyaroLinked && parsed.data.discordIdentifier !== undefined) {
        const rawDiscord = parsed.data.discordIdentifier.trim();
        const discordId = rawDiscord.replace(/^discord:/i, '');
        if (!rawDiscord.length) {
            discordData = false;
        } else if (!consts.validIdentifierParts.discord.test(discordId)) {
            return ctx.send<ApiSelfIdentifiersResp>({
                error: 'Enter the numeric Discord user ID (17 to 20 digits).',
            });
        } else {
            discordData = { id: discordId, identifier: `discord:${discordId}` };
        }
    }

    //Do not let an administrator claim an identifier already attached to a
    //different local account.
    for (const providerData of [citizenfxData, discordData]) {
        if (!providerData) continue;
        const existing = txCore.adminStore.getAdminByIdentifiers([providerData.identifier]);
        if (existing && existing.name.toLowerCase() !== ctx.admin.name.toLowerCase()) {
            return ctx.send<ApiSelfIdentifiersResp>({
                error: `${providerData.identifier} is already linked to another administrator.`,
            });
        }
    }

    try {
        await txCore.adminStore.editAdmin(ctx.admin.name, citizenfxData, discordData);
        const savedAdmin = txCore.adminStore.getAdminByName(ctx.admin.name);
        const savedCfx = savedAdmin?.providers?.citizenfx?.identifier;
        const savedDiscordId = chyaroLinked
            ? savedAdmin?.providers?.chyarologin?.data?.discordId
            : savedAdmin?.providers?.discord?.id;
        const savedDiscord = savedDiscordId ? `discord:${savedDiscordId}` : undefined;
        ctx.admin.logAction(`Changing own identifiers to ${savedCfx || 'no cfx.re ID'}, ${savedDiscord || 'no Discord ID'}`);
        return ctx.send<ApiSelfIdentifiersResp>({
            success: true,
            cfxIdentifier: savedCfx,
            discordIdentifier: savedDiscord,
        });
    } catch (error) {
        return ctx.send<ApiSelfIdentifiersResp>({ error: (error as Error).message });
    }
}
