import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { cadminRequest, requireCadminPermission } from '@lib/cadminApi';

export default async function CadminPlayers(ctx: AuthedCtx) {
    const query = typeof ctx.query.q === 'string' ? ctx.query.q.trim() : '';
    const permission = query ? 'cadmin.players.search_offline' : 'cadmin.players.view';
    if (!requireCadminPermission(ctx, permission)) return;
    try {
        const data = query
            ? await cadminRequest('GET', '/players/search', { query: { q: query } })
            : await cadminRequest('GET', '/players');
        return ctx.send({ success: true, data });
    } catch (error) { return ctx.send({ success: false, error: (error as Error).message }); }
}
