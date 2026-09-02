import path from 'node:path';
import fsp from 'node:fs/promises';
import fse from 'fs-extra';
import { randomBytes } from 'node:crypto';
import { txEnv, txHostConfig } from '@core/globalData';
import { getTcpPortFromServerCfg } from '@lib/fxserver/serverCfgPort';

export type CadminFramework = 'auto' | 'esx' | 'qbox';

/** A `set <convar> "<value>"` pair, written to server.cfg and replayed on the live server. */
export type CadminConvar = [convar: string, value: string];

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

/**
 * The Qbox group tools set ACE principals by running `add_principal` and `add_ace`
 * from inside the resource. FXServer only lets a resource run a console command
 * when the ACL permits it, per the server-commands manual: the EXECUTE_COMMAND
 * function works "if a resource is permitted by the ACL". Without these grants the
 * server answers every group change with `Access denied for command add_principal`
 * and the group silently never applies.
 *
 * The principal is `resource.<name>`, so this is a grant of four specific commands
 * to this one resource, not blanket console access.
 */
const CADMIN_RESOURCE_COMMANDS = [
    'command.add_principal',
    'command.add_ace',
    'command.remove_principal',
    'command.remove_ace',
] as const;

export const cadminResourceAceLines = CADMIN_RESOURCE_COMMANDS.map(
    (command) => `add_ace resource.cadminpanel ${command} allow`,
);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Appends a whole cfg line unless an equivalent one is already there, whitespace aside. */
const ensureCfgLine = (cfg: string, line: string) => {
    const body = escapeRegex(line.trim()).replace(/\s+/g, '\\s+');
    const matcher = new RegExp(`^\\s*${body}\\s*$`, 'mi');
    return matcher.test(cfg) ? cfg : `${cfg.trimEnd()}\n${line}\n`;
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
    const panelUrl = txConfig.general.publicPanelUrl || `http://127.0.0.1:${txHostConfig.txaPort}`;
    const convars: CadminConvar[] = [
        ['cadmin_api_secret', secret],
        ['cadmin_framework', options.framework],
        ['cadmin_dirty_money_item', options.dirtyMoneyItem || 'black_money'],
        ['cadmin_panel_url', panelUrl],
    ];
    let cfg = await fsp.readFile(cfgPath, 'utf8');
    // Resource startup must come after its convars: config.lua reads the
    // framework, dirty-money item, and panel URL when the resource loads.
    cfg = cfg.replace(/^\s*ensure\s+cadminpanel\s*$(?:\r?\n)?/gmi, '');
    for (const [convar, value] of convars) {
        cfg = setCfgLine(cfg, convar, value);
    }
    for (const line of cadminResourceAceLines) {
        cfg = ensureCfgLine(cfg, line);
    }
    cfg = `${cfg.trimEnd()}\nensure cadminpanel\n`;
    await fsp.writeFile(cfgPath, cfg, 'utf8');
    const serverPort = getTcpPortFromServerCfg(cfg, txHostConfig.fxsPort);

    return {
        secret,
        convars,
        resourcePath: targetPath,
        apiUrl: `http://127.0.0.1:${serverPort}/cadminpanel`,
    };
}


/**
 * Applies a fresh install to the server that is already running, so the admin does not
 * have to restart it. The convars have to land before the resource starts because its
 * config.lua reads them at load time, and `refresh` is what makes fxserver notice the
 * folder that was just copied into the resources directory.
 * The ACE grants go through the same channel, which reaches fxserver's stdin and so
 * runs as the console principal, the one context always allowed to edit the ACL.
 * Returns false when there is no server to talk to, in which case the next boot will
 * pick everything up from server.cfg instead.
 */
export function applyCadminResourceLive(convars: CadminConvar[], author: string) {
    if (!txCore.fxRunner.child?.isAlive) return false;
    for (const [convar, value] of convars) {
        txCore.fxRunner.sendCommand('set', [convar, value], author);
    }
    for (const line of cadminResourceAceLines) {
        txCore.fxRunner.sendRawCommand(line, author);
    }
    txCore.fxRunner.sendRawCommand('refresh', author);
    //`ensure` instead of `start` so reinstalling over a running copy reloads it
    return txCore.fxRunner.sendRawCommand('ensure cadminpanel', author) !== false;
}
