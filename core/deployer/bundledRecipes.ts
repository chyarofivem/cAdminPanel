import { RECIPE_DEPLOYER_VERSION } from './index.js';

export const BUNDLED_RECIPES = [
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'Empty FiveM server',
        author: 'Cfx.re',
        description: 'A minimal FiveM server with the default Cfx.re resources.',
        framework: 'none',
        tags: ['fivem', 'none'],
        url: 'https://raw.githubusercontent.com/citizenfx/txAdmin-recipes/refs/heads/main/default-fivem/recipe.yaml',
    },
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'ESX',
        author: 'ESX Framework',
        description: 'The official ESX Legacy recipe.',
        framework: 'esx',
        tags: ['fivem', 'esx'],
        url: 'https://raw.githubusercontent.com/esx-framework/ESX-recipes/legacy/recipe.yaml',
    },
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'QBOX',
        author: 'Qbox Project',
        description: 'The official Qbox framework recipe.',
        framework: 'qbox',
        tags: ['fivem', 'qbox'],
        url: 'https://raw.githubusercontent.com/Qbox-project/txAdminRecipe/refs/heads/main/qbox.yaml',
    },
] as const;

export type BundledFramework = typeof BUNDLED_RECIPES[number]['framework'];
