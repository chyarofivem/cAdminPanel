const modulename = 'WebServer:DeployerData';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { txHostConfig } from '@core/globalData';
import consoleFactory from '@lib/console';
import { TxConfigState } from '@shared/enums';
import type { DeployerDataResp } from '@shared/deployerApiTypes';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
const console = consoleFactory(modulename);

const knownVariableDescriptions: Record<string, string> = {
    steam_webApiKey: 'Used to authenticate Steam identifiers. Create one through the Steam Web API key page.',
};

const readServerCfg = async (deployPath: string) => {
    const errorMessage = [
        '# server.cfg not found',
        '# The file may have been removed before this step.',
        '# Exit the wizard and start the deployment again, or replace this text with a valid server.cfg.',
    ].join('\n');
    try {
        const contents = await fsp.readFile(path.join(deployPath, 'server.cfg'), 'utf8');
        if (contents === '#save_attempt_please_ignore' || !contents.length) return errorMessage;
        if (contents.length > 10_240) {
            return '# The generated server.cfg exceeds 10 KB. Review the recipe and start the deployment again.';
        }
        return contents;
    } catch (error) {
        console.verbose.dir(error);
        return errorMessage;
    }
};

export default async function DeployerDataRoute(ctx: AuthedCtx) {
    const send = (data: DeployerDataResp) => ctx.send<DeployerDataResp>(data);
    if (!ctx.admin.testPermission('master', modulename)) {
        return send({ error: 'Only the master account can use the deployer.' });
    }
    if (txManager.configState === TxConfigState.Setup) return send({ redirect: '/server/setup' });
    if (txManager.configState !== TxConfigState.Deployer || !txManager.deployer?.step) {
        return send({ redirect: '/' });
    }

    const deployer = txManager.deployer;
    const common = { deploymentID: deployer.deploymentID };
    if (deployer.step === 'review') {
        return send({
            ...common,
            step: 'review',
            recipe: {
                isTrustedSource: deployer.isTrustedSource,
                name: deployer.recipe.name,
                author: deployer.recipe.author,
                description: deployer.recipe.description,
                raw: deployer.recipe.raw,
            },
        });
    }
    if (deployer.step === 'input') {
        const recipeVars = deployer.getRecipeVars();
        return send({
            ...common,
            step: 'input',
            requireDBConfig: deployer.recipe.requireDBConfig,
            hostConfigSource: txHostConfig.sourceName,
            defaults: {
                autofilled: Object.values(txHostConfig.defaults).some(Boolean),
                license: txHostConfig.defaults.cfxKey ?? '',
                mysqlHost: txHostConfig.defaults.dbHost ?? 'localhost',
                mysqlPort: String(txHostConfig.defaults.dbPort ?? '3306'),
                mysqlUser: txHostConfig.defaults.dbUser ?? 'root',
                mysqlPassword: txHostConfig.defaults.dbPass ?? '',
                mysqlDatabase: txHostConfig.defaults.dbName ?? deployer.deploymentID,
            },
            inputVars: Object.keys(recipeVars).map(name => ({
                name,
                value: String(recipeVars[name] ?? ''),
                description: knownVariableDescriptions[name] ?? '',
            })),
        });
    }
    if (deployer.step === 'run') {
        return send({
            ...common,
            step: 'run',
            deployPath: deployer.deployPath,
            progress: deployer.progress,
            log: deployer.getDeployerLog(),
            status: deployer.deployFailed ? 'failed' : 'running',
        });
    }
    if (deployer.step === 'configure') {
        return send({
            ...common,
            step: 'configure',
            serverCFG: await readServerCfg(deployer.deployPath),
            framework: deployer.framework,
        });
    }
    return send({ error: 'Unknown deployer step. Restart the panel and try again.' });
}
