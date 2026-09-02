import { RECIPE_DEPLOYER_VERSION } from './index.js';

/**
 * The curated "Popular Recipes" list offered by the setup wizard, mirroring the
 * recipes upstream txAdmin ships in `citizenfx/txAdmin-recipes/indexv4.json` and
 * `indexv5.json`. Every URL here is fetched over the network at deploy time and
 * marked as a trusted source, so an entry is only added after its `$engine` is
 * confirmed compatible and every action it uses exists in `recipeEngine.js`.
 *
 * `tags` carries the game as its first entry; the wizard filters on it when
 * `TXHOST_GAME_NAME` forces one, so a template with no game tag is unreachable
 * on a forced host.
 *
 * `framework` is an assertion that Character Management can bridge the deployed
 * server, and it drives the post-deploy install prompt. Only `esx` and `qbox`
 * have adapters under `resource/cadminpanel/server/framework/`, and the Qbox one
 * detects `qbx_core` specifically. Everything else is `none`, QBCore included:
 * qb-core is not qbx_core and the bridge will not pick it up, so promising the
 * install there would hand the operator a resource that never reports ready.
 *
 * The older `indexv1` through `indexv3` recipes are deliberately absent. They
 * target recipe engines below 3 or point at superseded forks, and `recipeParser`
 * rejects an `$engine` under RECIPE_DEPLOYER_VERSION.
 *
 * Upstream's `default-fivem-enhanced` is also deliberately absent. cAdminPanel is
 * not compatible with FiveM Enhanced, so offering its baseline template would
 * deploy a server this panel cannot manage. Do not re-add it when syncing this
 * list against upstream.
 */
export const BUNDLED_RECIPES = [
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'FiveM Basic Server (CFX Default)',
        author: 'Cfx.re',
        description: 'A minimal FiveM server, no framework, with just the config and resources required to run.',
        framework: 'none',
        tags: ['fivem'],
        url: 'https://raw.githubusercontent.com/citizenfx/txAdmin-recipes/refs/heads/main/default-fivem/recipe.yaml',
    },
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'ESX Legacy',
        author: 'ESX Framework',
        description: 'The official recipe for the most popular FiveM roleplay framework, with jobs, housing and vehicles.',
        framework: 'esx',
        tags: ['fivem', 'roleplay'],
        url: 'https://raw.githubusercontent.com/esx-framework/ESX-recipes/legacy/recipe.yaml',
    },
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'Qbox',
        author: 'Qbox Project',
        description: 'The official Qbox recipe. Modern and optimized, and compatible with QBCore resources.',
        framework: 'qbox',
        tags: ['fivem', 'roleplay'],
        url: 'https://raw.githubusercontent.com/Qbox-project/txAdminRecipe/refs/heads/main/qbox.yaml',
    },
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'QBCore',
        author: 'QBCore Framework',
        description: 'An advanced FiveM roleplay framework with jobs, gangs and housing. Needs a database.',
        framework: 'none',
        tags: ['fivem', 'roleplay'],
        url: 'https://raw.githubusercontent.com/qbcore-framework/txAdminRecipe/main/qbcore.yaml',
    },
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'StreetKings',
        author: '919DESIGN & Envi-Scripts',
        description: 'A freeroam street racing gamemode. Race solo or against other players to level up through daily events. Needs a database.',
        framework: 'none',
        tags: ['fivem', 'racing'],
        url: 'https://raw.githubusercontent.com/streetkings-fivem/txAdminRecipe/refs/heads/main/streetkings.yaml',
    },
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'RedM Basic Server (CFX Default)',
        author: 'Cfx.re',
        description: 'A minimal RedM server with the default Cfx.re resources. Sets gamename to rdr3 for you.',
        framework: 'none',
        tags: ['redm'],
        url: 'https://raw.githubusercontent.com/citizenfx/txAdmin-recipes/refs/heads/main/default-redm/recipe.yaml',
    },
    {
        engine: RECIPE_DEPLOYER_VERSION,
        name: 'VORP Core',
        author: 'VORP Core',
        description: 'The official VORP Core recipe, the main RedM roleplay framework. Needs a database and a Steam Web API key.',
        framework: 'none',
        tags: ['redm', 'roleplay'],
        url: 'https://raw.githubusercontent.com/VORPCORE/VORP_txAdmin/main/vorp_recipe.yaml',
    },
] as const;

export type BundledFramework = typeof BUNDLED_RECIPES[number]['framework'];
