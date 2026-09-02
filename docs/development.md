# cAdminPanel Development
If you are interested in development of cAdminPanel, this short guide will help setup your environment.
Before starting, please make sure you are familiar with the basics of NodeJS & ecosystem.
> **Note:** This guide does not cover translations, [which are very easy to do!](./translation.md)  


## Requirements
- Windows, as the builder doesn't work for other OSs;
- NodeJS v22.9 or newer;
- FXServer;


## Project Structure
- `core`: Node Backend & Modules. This part is transpiled by `tsc` and then bundled with `esbuild`;
    - `boot`: Code used/triggered during the boot process.
    - `deployer`: Responsible for deploying new servers.
    - `lib`: Collection of stateles utils, helpers and business logic.
    - `modules`: The classes that compose the panel instance, they are stateful, provide specific functionalities and are interconnected with each other.
    - `routes`: All the web routes, contain all the logic referenced in the HTTP router.
    - `testing`: Contains top-level testing utilities.
- `resource`: The in-game resource that runs under the `monitor` name. These files will be synchronized with the deploy path when running the `dev:main` npm script;
- `nui`: React source code for the in-game menu. It is transpiled and built using Vite;
- `panel`: The only web administration UI, built with React and Vite;
- `scripts`: The scripts used for development only;
- `shared`: Stuff used across multiple workspaces like small functions and type definitions.


## Preparing the environment
1. First, clone the cAdminPanel repository into a folder outside the fxserver directory;
```sh
git clone https://github.com/chyarofivem/cAdminPanel
```
2. Install dependencies & prepare commit hook;
```sh
# In your root folder run the following
npm install
npm run prepare
```
3. At the root of the project, create a `.env` file with `TXDEV_FXSERVER_PATH` pointing to the path of your FXServer folder.
```
TXDEV_FXSERVER_PATH='E:/FiveM/10309/'
```


## Development Workflows

### Core/Panel/Resource
This workflow is controlled by `scripts/build/*`, which is responsible for:
- Watching and copying static files (resource, docs, license, entry file, etc) to the deploy path;
- Watching and re-transpiling the core files, and then bundling and deploying it;
- Run FXServer (in the same terminal), and restarting it when the core is modified (like `nodemon`, but fancy).
  
In dev mode, core will redirect the panel `index.html` to use Vite, so you first need to start it, and only then start the builder:
```sh
# run vite
cd panel
npm run dev

# In a new terminal - run the builder
cd core
npm run dev
```
  
### NUI Menu
```sh
cd nui

#To run Vite on game dev mode:
npm run dev

#To run Vite on browser dev mode:
npm run browser
```
Keep in mind that for every change you will need to restart the `monitor` resource, and unless you started the server with `+setr txAdmin-debugMode true` the panel will detect that as a crash and restart your server.  
Also, when running in game mode, it takes between 10 and 30 seconds for the vite builder to finish for you to be able to restart the `monitor` resource ingame.

### Resource event naming rules:
- The event prefix must be `tx<cl|sv>:` indicating where it is registered.
- Events that request something (like permission) from the server starts with `txsv:req`.
- Events can have verbs like `txsv:checkAdminStatus` or `txcl:setServerCtx`.
- Since most events are menu related, scoping events to menu is not required.

### Testing & Building
The building process is normally done in the GitHub Action workflow only, but if you _must_ build it locally, that can be done with the command below. The output will be on the `dist/` folder.
```sh
npm run test --workspaces
GITHUB_REF="refs/tags/v9.9.9" npm run build
```

On Windows, the complete local build and release archive can be recreated with:
```powershell
npm run fullcompile
```
This command uses the root package version when `GITHUB_REF` is unset, rebuilds the complete `dist/` directory, and
replaces `monitor.zip` with the build stored under a single top-level `monitor/` directory.

> FIXME: add linting & typechecking back into the workflow above


## Notes regarding the Settings system
- `config.json` now only contains the changed, non-default values.
- `DEFAULT_NULL` is only for values that cannot and should not have defaults, like `fxRunner.dataPath`, `discordBot.token`, etc. Note how `fxRunner.cfgPath` does have a default.
- All schemas must have a default, even if `null`.
- The objective of the `schema.fixer` is to fix invalid values, not apply defaults for missing values.
- The `schema.fixer` is only used during boot, not during any saves.
- Only use `SYM_FIXER_FATAL` for settings that are very important, so the panel rather not boot than to boot with an unexpected config.
- The objective of the schema is to guarantee that the values are of the correct type (shouldn't cause TypeErrors), but does not check anything dynamic like existence of files, or anything that goes beyond one schema (eg. if bot enabled, token is required).
- Validator transformers are only to "polish" the value, like removing duplicates and sorting values, not to fix invalid values.


## Web administration UI

The React application in `panel/` is the only web administration interface. Document routes outside its route table resolve to the panel 404 state. Static browser assets belong in `panel/public/`.
