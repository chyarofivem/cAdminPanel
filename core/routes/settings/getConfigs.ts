const modulename = 'WebServer:GetSettingsConfigs';
import localeMap from '@shared/localeMap';
import consoleFactory from '@lib/console';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { GenericApiErrorResp } from '@shared/genericApiTypes';
import ConfigStore from '@modules/ConfigStore';
import { PartialTxConfigs, TxConfigs } from '@modules/ConfigStore/schema';
import { ConfigChangelogEntry } from '@modules/ConfigStore/changelog';
import { txHostConfig } from '@core/globalData';
import fsp from 'node:fs/promises';
import { resolveCFGFilePath } from '@lib/fxserver/fxsConfigHelper';
import { getTcpPortFromServerCfg } from '@lib/fxserver/serverCfgPort';
import { cloneDeep } from 'lodash-es';
import { getVisibleSettingsConfig } from './configAccess';
const console = consoleFactory(modulename);


export type GetConfigsResp = {
    locales: { code: string, label: string }[],
    dataPath: string,
    hasCustomDataPath: boolean,
    changelog: ConfigChangelogEntry[],
    storedConfigs: PartialTxConfigs,
    defaultConfigs: TxConfigs,
    forceQuietMode: boolean,
}


/**
 * Returns the output page containing the live console
 */
export default async function GetSettingsConfigs(ctx: AuthedCtx) {
    const sendTypedResp = (data: GetConfigsResp | GenericApiErrorResp) => ctx.send(data);

    //Check permissions
    if (!ctx.admin.testPermission('settings.view', modulename)) {
        return sendTypedResp({
            error: 'You do not have permission to view the settings.'
        });
    }

    //Prepare data
    const locales = Object.keys(localeMap).map(code => ({
        code,
        label: localeMap[code].$meta.label,
    }));
    locales.sort((a, b) => a.label.localeCompare(b.label));

    const access = {
        isMaster: ctx.admin.isMaster,
        canWrite: ctx.admin.hasPermission('settings.write'),
    };
    const defaultConfigs = cloneDeep(ConfigStore.SchemaDefaults) as any;
    const outData: GetConfigsResp = {
        locales,
        dataPath: txHostConfig.dataPath,
        hasCustomDataPath: txHostConfig.hasCustomDataPath,
        changelog: txCore.configStore.getChangelog(),
        storedConfigs: getVisibleSettingsConfig(txCore.configStore.getStoredConfig(), access),
        defaultConfigs,
        forceQuietMode: txHostConfig.forceQuietMode,
    };

    if (!outData.storedConfigs.cadmin?.apiUrl) {
        try {
            if (typeof txConfig.server.cfgPath !== 'string' || typeof txConfig.server.dataPath !== 'string') {
                throw new Error('FXServer paths are not configured.');
            }
            const cfgPath = resolveCFGFilePath(txConfig.server.cfgPath, txConfig.server.dataPath);
            const cfg = await fsp.readFile(cfgPath, 'utf8');
            defaultConfigs.cadmin.apiUrl = `http://127.0.0.1:${getTcpPortFromServerCfg(cfg)}/cadminpanel`;
        } catch (error) {
            console.warn(`Could not derive the Character Management bridge port: ${(error as Error).message}`);
        }
    }

    return sendTypedResp(outData);
};
