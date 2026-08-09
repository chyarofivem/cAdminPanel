export type DeploymentType = 'popular' | 'local' | 'remote' | 'custom';

export type BundledRecipe = {
    name: string;
    author: string;
    description: string;
    framework: string;
    tags: readonly string[];
    url: string;
};

export type SetupPageData = {
    skipServerName: boolean;
    serverName: string;
    deployerEngineVersion: number;
    forceGameName: string | false;
    dataPath: string;
    hasCustomDataPath: boolean;
    hostConfigSource: string;
    bundledRecipes: BundledRecipe[];
};

export type SetupDataApiResp = { error: string } | { redirect: string } | SetupPageData;

/**
 * The wizard state, threaded through every step.
 * `targetPath` is the deploy destination for recipe based flows, while
 * `dataFolder`/`cfgFile` are only used by the existing-server-data flow.
 */
export type SetupState = {
    serverName: string;
    deploymentType: DeploymentType | null;
    recipeURL: string;
    framework: string;
    recipeName: string;
    deploymentID: string;
    targetPath: string;
    dataFolder: string;
    cfgFile: string;
};

export const emptySetupState: SetupState = {
    serverName: '',
    deploymentType: null,
    recipeURL: '',
    framework: 'custom',
    recipeName: '',
    deploymentID: '',
    targetPath: '',
    dataFolder: '',
    cfgFile: '',
};

/**
 * Mirrors the legacy `buildDeployName()`: a filesystem-safe name plus a short
 * hex timestamp, used for both the deployment id and the target folder.
 */
export const buildDeployName = (templateName: string, dataPath: string) => {
    const treatedName = templateName.replace(/[^a-zA-Z0-9\.\-_]/g, '');
    const shortName = treatedName.length < 3 ? 'DumbName' : treatedName;
    const timestamp = Math.round(Date.now() / 1000)
        .toString(16)
        .padStart(6, '0')
        .slice(-6)
        .toUpperCase();
    return {
        id: `${shortName}_${timestamp}`,
        path: `${dataPath}/${shortName}_${timestamp}.base`,
    };
};

export const tagColorClass = (tag: string) => {
    if (tag === 'fivem') return 'text-[#FF8637] border-[#FF8637]/60 bg-[#FF8637]/10';
    if (tag === 'redm') return 'text-[#FA0211] border-[#FA0211]/60 bg-[#FA0211]/10';
    return 'text-neutral-300 border-white/20 bg-white/5';
};
