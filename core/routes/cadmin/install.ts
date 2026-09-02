import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { applyCadminResourceLive, installCadminResource, type CadminFramework } from '@lib/cadminInstaller';
import { assertCadminReady, cadminRequest } from '@lib/cadminApi';

export default async function CadminInstall(ctx: AuthedCtx) {
    if (!ctx.admin.testPermission('master', 'WebServer:CadminInstall')) {
        ctx.status = 403;
        return ctx.send({ success: false, error: 'Only the master can configure Character Management.' });
    }
    const action = ctx.params.action;
    if (action === 'test') {
        try {
            const ping = await cadminRequest('GET', '/ping');
            assertCadminReady(ping);
            return ctx.send({ success: true, data: ping });
        }
        catch (error) { return ctx.send({ success: false, error: (error as Error).message }); }
    }
    if (action === 'skip') {
        txCore.configStore.saveConfigs({ cadmin: { enabled: false, installSkipped: true } }, ctx.admin.name);
        ctx.admin.logAction('cadmin: skipped resource installation.');
        return ctx.send({ success: true });
    }
    if (action !== 'install') return ctx.utils.error(400, 'Unknown Character Management action.');

    const paths = txCore.fxRunner.serverPaths;
    if (!paths) return ctx.send({ success: false, error: 'Configure the game server paths first.' });
    const framework = ['auto', 'esx', 'qbox'].includes(ctx.request.body?.framework)
        ? ctx.request.body.framework as CadminFramework
        : txConfig.cadmin.framework;
    const dirtyMoneyItem = typeof ctx.request.body?.dirtyMoneyItem === 'string'
        ? ctx.request.body.dirtyMoneyItem.trim()
        : txConfig.cadmin.dirtyMoneyItem;
    try {
        const installed = await installCadminResource({
            dataPath: paths.dataPath,
            cfgPath: paths.cfgPath,
            framework,
            dirtyMoneyItem,
        });
        txCore.configStore.saveConfigs({
            cadmin: {
                enabled: true,
                installSkipped: false,
                apiUrl: installed.apiUrl,
                apiSecret: installed.secret,
                dirtyMoneyItem,
                framework,
            },
        }, ctx.admin.name);
        ctx.admin.logAction(`cadmin: installed resource for ${framework}.`);
        //Convars, a resource rescan and the resource start, so a running server picks the
        //install up without a restart. Skipped (and unnecessary) when the server is down.
        const started = applyCadminResourceLive(installed.convars, ctx.admin.name);
        return ctx.send({
            success: true,
            data: {
                resourcePath: installed.resourcePath,
                apiUrl: installed.apiUrl,
                started,
            },
        });
    } catch (error) {
        return ctx.send({ success: false, error: (error as Error).message });
    }
}
