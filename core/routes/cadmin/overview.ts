import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { cadminRequest } from '@lib/cadminApi';

export default async function CadminOverview(ctx: AuthedCtx) {
    const result: any = {
        status: { online: false, framework: txConfig.cadmin.framework, version: null, oxInventory: false, error: null },
        players: [],
        recent: [],
    };
    try {
        const ping: any = await cadminRequest('GET', '/ping');
        const pingFramework = typeof ping?.framework === 'string'
            ? ping.framework
            : txConfig.cadmin.framework;
        const pingVersion = typeof ping?.version === 'string' || typeof ping?.version === 'number'
            ? String(ping.version)
            : null;
        let schemaWarning: string | null = null;
        if (typeof ping?.schema === 'string') {
            schemaWarning = ping.schema;
        } else if (ping?.schema?.checked === true && ping.schema.ok !== true) {
            const missingTables = Array.isArray(ping.schema.missingTables)
                ? ping.schema.missingTables.filter((entry: unknown) => typeof entry === 'string')
                : [];
            schemaWarning = missingTables.length
                ? `Character Management cannot find the required database tables: ${missingTables.join(', ')}.`
                : 'Character Management could not prepare its database tables. Check the FXServer console for details.';
        }
        result.status = {
            online: true,
            framework: pingFramework,
            version: pingVersion,
            oxInventory: Boolean(ping?.oxInventory),
            schema: schemaWarning,
            error: null,
        };
        if (ctx.admin.hasPermission('cadmin.players.view')) result.players = await cadminRequest('GET', '/players');
    } catch (error) { result.status.error = (error as Error).message; }
    if (ctx.admin.hasPermission('panel.log.view')) {
        const raw = await txCore.logger.admin.getRecentBuffer();
        result.recent = (raw || '').split(/\r?\n/).filter((line: string) => line.toLowerCase().includes('cadmin:')).slice(-8).reverse();
    }
    return ctx.send({ success: true, data: result });
}
