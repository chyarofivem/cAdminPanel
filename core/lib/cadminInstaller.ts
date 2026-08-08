import path from 'node:path';
import fsp from 'node:fs/promises';
import fse from 'fs-extra';
import { randomBytes } from 'node:crypto';
import { txEnv, txHostConfig } from '@core/globalData';
import { getTcpPortFromServerCfg } from '@lib/fxserver/serverCfgPort';

export type CadminFramework = 'auto' | 'esx' | 'qbox';

type InstallOptions = {
    dataPath: string;
    cfgPath: string;
    framework: CadminFramework;
    dirtyMoneyItem?: string;
    apiSecret?: string;
};

const setCfgLine = (cfg: string, key: string, value: string) => {
    const escaped = value.replace(/["\r\n]/g, '');
    const line = `set ${key} "${escaped}"`;
    const matcher = new RegExp(`^\\s*set\\s+${key}\\s+.*$`, 'mi');
    return matcher.test(cfg) ? cfg.replace(matcher, line) : `${cfg.trimEnd()}\n${line}\n`;
};

export async function installCadminResource(options: InstallOptions) {
    const sourcePath = path.resolve(txEnv.txaPath, 'resource', 'cadminpanel');
    const dataPath = path.resolve(options.dataPath);
    const resourcesPath = path.resolve(dataPath, 'resources');
    const targetPath = path.resolve(resourcesPath, 'cadminpanel');
    const cfgPath = path.resolve(options.cfgPath);
    if (!targetPath.startsWith(resourcesPath + path.sep)) {
        throw new Error('Refusing to install outside the configured resources directory.');
    }
    if (!await fse.pathExists(sourcePath)) throw new Error('The bundled cadminpanel resource is missing.');
    if (!await fse.pathExists(resourcesPath)) throw new Error('The configured resources directory does not exist.');

    await fse.copy(sourcePath, targetPath, { overwrite: true, errorOnExist: false });
    const secret = options.apiSecret || randomBytes(32).toString('base64url');
    const panelUrl = txHostConfig.txaUrl || `http://127.0.0.1:${txHostConfig.txaPort}`;
    let cfg = await fsp.readFile(cfgPath, 'utf8');
    // Resource startup must come after its convars: config.lua reads the
    // framework, dirty-money item, and panel URL when the resource loads.
    cfg = cfg.replace(/^\s*ensure\s+cadminpanel\s*$(?:\r?\n)?/gmi, '');
    cfg = setCfgLine(cfg, 'cadmin_api_secret', secret);
    cfg = setCfgLine(cfg, 'cadmin_framework', options.framework);
    cfg = setCfgLine(cfg, 'cadmin_dirty_money_item', options.dirtyMoneyItem || 'black_money');
    cfg = setCfgLine(cfg, 'cadmin_panel_url', panelUrl);
    cfg = `${cfg.trimEnd()}\nensure cadminpanel\n`;
    await fsp.writeFile(cfgPath, cfg, 'utf8');
    const serverPort = getTcpPortFromServerCfg(cfg, txHostConfig.fxsPort);

    return {
        secret,
        resourcePath: targetPath,
        apiUrl: `http://127.0.0.1:${serverPort}/cadminpanel`,
    };
}
