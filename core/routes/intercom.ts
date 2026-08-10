const modulename = 'WebServer:Intercom';
import { cloneDeep }  from 'lodash-es';
import { txEnv } from '@core/globalData';
import consoleFactory from '@lib/console';
import { InitializedCtx } from '@modules/WebServer/ctxTypes';
import { brandingUrl, panelDisplayName } from '@lib/branding';
import { ACCENTS, resolveAccent } from '@lib/theme';
import consts from '@shared/consts';
const console = consoleFactory(modulename);


/**
 * Intercommunications endpoint
 */
export default async function Intercom(ctx: InitializedCtx) {
    //Sanity check
    if ((typeof (ctx as any).params.scope !== 'string') || (ctx as any).request.body === undefined) {
        return ctx.utils.error(400, 'Invalid Request');
    }
    const scope = (ctx as any).params.scope as string;

    const postData = cloneDeep(ctx.request.body);
    postData.txAdminToken = true;

    //Delegate to the specific scope functions
    if (scope == 'monitor') {
        try {
            txCore.fxMonitor.handleHeartBeat('http');
            return ctx.send(txCore.metrics.txRuntime.currHbData);
        } catch (error) {
            return ctx.send({
                txAdminVersion: txEnv.txaVersion,
                success: false,
            });
        }
    } else if (scope == 'branding') {
        const accent = resolveAccent(txConfig.general.accent);
        return ctx.send({
            success: true,
            panelName: panelDisplayName(),
            accent,
            accentColor: ACCENTS[accent].hex,
            logoUrl: brandingUrl('logo', false, consts.nuiWebpipePath),
            bannerUrl: brandingUrl('banner', false, consts.nuiWebpipePath),
        });
    } else if (scope == 'resources') {
        if (!Array.isArray(postData.resources)) {
            return ctx.utils.error(400, 'Invalid Request');
        }
        txCore.fxResources.tmpUpdateResourceList(postData.resources);
        return ctx.send({ success: true, txAdminVersion: txEnv.txaVersion });
    } else {
        return ctx.send({
            type: 'danger',
            message: 'Unknown intercom scope.',
        });
    }

    return ctx.send({
        txAdminVersion: txEnv.txaVersion,
        success: false,
    });
};
