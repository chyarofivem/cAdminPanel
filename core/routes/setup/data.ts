const modulename = 'WebServer:SetupData';
import { txHostConfig } from '@core/globalData';
import { RECIPE_DEPLOYER_VERSION } from '@core/deployer/index';
import { BUNDLED_RECIPES } from '@core/deployer/bundledRecipes';
import { TxConfigState } from '@shared/enums';
import consoleFactory from '@lib/console';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
const console = consoleFactory(modulename);


export type SetupDataResp = {
    error: string;
} | {
    redirect: string;
} | {
    skipServerName: boolean;
    serverName: string;
    deployerEngineVersion: number;
    forceGameName: string | false;
    dataPath: string;
    hasCustomDataPath: boolean;
    hostConfigSource: string;
    bundledRecipes: {
        name: string;
        author: string;
        description: string;
        framework: string;
        tags: readonly string[];
        url: string;
    }[];
};


/**
 * Returns everything the setup wizard page needs to render.
 * Replaces the data that used to be injected into the legacy setup.ejs template.
 */
export default async function SetupData(ctx: AuthedCtx) {
    //Check permissions
    if (!ctx.admin.hasPermission('master')) {
        return ctx.send<SetupDataResp>({
            error: 'You need to be the admin master to use the setup page.',
        });
    }

    //Ensure the correct state for the setup page
    if (txManager.configState === TxConfigState.Deployer) {
        return ctx.send<SetupDataResp>({ redirect: '/server/deployer' });
    } else if (txManager.configState !== TxConfigState.Setup) {
        return ctx.send<SetupDataResp>({ redirect: '/' });
    }

    const storedConfig = txCore.configStore.getStoredConfig();
    const storedName = storedConfig.general?.serverName;
    return ctx.send<SetupDataResp>({
        skipServerName: !!storedName,
        serverName: typeof storedName === 'string' ? storedName : '',
        deployerEngineVersion: RECIPE_DEPLOYER_VERSION,
        forceGameName: txHostConfig.forceGameName ?? false,
        dataPath: txHostConfig.dataPath,
        hasCustomDataPath: txHostConfig.hasCustomDataPath,
        hostConfigSource: txHostConfig.sourceName,
        bundledRecipes: BUNDLED_RECIPES.map((recipe) => ({
            name: recipe.name,
            author: recipe.author,
            description: recipe.description,
            framework: recipe.framework,
            tags: recipe.tags,
            url: recipe.url,
        })),
    });
};
