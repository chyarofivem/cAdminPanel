import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate as setLocation } from 'wouter/use-browser-location';
import Markdown from 'react-markdown';
import {
    AlertTriangle, ArrowLeft, ArrowRight, CloudDownload, FileCog, FolderTree,
    Layers, Loader2, PencilRuler, Rocket, Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TxConfigState } from '@shared/enums';
import { ApiTimeout, useBackendApi } from '@/hooks/fetch';
import { useSetTxConfigState } from '@/hooks/status';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { reloadPanel } from '@/lib/navigation';
import SetupShell, { SetupSpinner, StepActions, StepHeading } from './SetupShell';
import {
    buildDeployName, emptySetupState, tagColorClass,
    type BundledRecipe, type DeploymentType, type SetupDataApiResp,
    type SetupPageData, type SetupState,
} from './setupTypes';

//The wizard steps, in the order they are walked through.
const STEP_NAME = 0;
const STEP_TYPE = 1;
const STEP_TEMPLATE = 2;
const STEP_LOCATION = 3;
const STEP_LAUNCH = 4;

type ValidationResp = {
    success: boolean;
    message?: string;
    markdown?: boolean;
    name?: string;
    suggestion?: string;
    detectedConfig?: string;
    refresh?: boolean;
};

const DEPLOYMENT_CHOICES: {
    type: DeploymentType;
    icon: typeof Layers;
    title: string;
    badge?: string;
    description: string;
}[] = [
    {
        type: 'popular',
        icon: Layers,
        title: 'Popular Recipes',
        badge: 'Recommended',
        description: 'Start from a curated template. Empty FiveM and RedM servers, ESX Legacy, Qbox, QBCore, StreetKings and VORP Core, all deployed from a trusted source.',
    },
    {
        type: 'local',
        icon: FolderTree,
        title: 'Existing Server Data',
        description: 'Point cAdminPanel at a server data folder that already exists on this host, with its own resources folder and server.cfg.',
    },
    {
        type: 'remote',
        icon: CloudDownload,
        title: 'Remote URL Template',
        description: 'Deploy from a recipe URL in the YAML format. You will be able to review the recipe before it runs.',
    },
    {
        type: 'custom',
        icon: PencilRuler,
        title: 'Custom Template',
        description: 'For a custom recipe-based server, or when writing your own recipe. You will be asked for the recipe right after this page.',
    },
];


export default function SetupPage() {
    const [pageData, setPageData] = useState<SetupPageData | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [stepIndex, setStepIndex] = useState(STEP_NAME);
    const [state, setState] = useState<SetupState>(emptySetupState);
    const [isBusy, setIsBusy] = useState(false);
    const [stepError, setStepError] = useState<string | null>(null);
    const [stepErrorIsMarkdown, setStepErrorIsMarkdown] = useState(false);
    const [pathSuggestion, setPathSuggestion] = useState<string | null>(null);
    const [detectedCfg, setDetectedCfg] = useState(false);
    const [targetPathLocked, setTargetPathLocked] = useState(true);
    const didLoad = useRef(false);
    const setTxConfigState = useSetTxConfigState();

    const dataApi = useBackendApi<SetupDataApiResp>({ method: 'GET', path: '/setup/data' });
    const validateRecipeUrlApi = useBackendApi<ValidationResp>({ method: 'POST', path: '/setup/validateRecipeURL' });
    const validateDeployPathApi = useBackendApi<ValidationResp>({ method: 'POST', path: '/setup/validateLocalDeployPath' });
    const validateDataFolderApi = useBackendApi<ValidationResp>({ method: 'POST', path: '/setup/validateLocalDataFolder' });
    const validateCfgApi = useBackendApi<ValidationResp>({ method: 'POST', path: '/setup/validateCFGFile' });
    const saveApi = useBackendApi<ValidationResp>({ method: 'POST', path: '/setup/save' });

    //Load the wizard bootstrap data once.
    useEffect(() => {
        if (didLoad.current) return;
        didLoad.current = true;
        dataApi({
            error: (message) => setLoadError(message),
            success: (resp) => {
                if ('error' in resp) return setLoadError(resp.error);
                if ('redirect' in resp) {
                    //This route knows the live config state, the cached one may be seconds
                    //behind and would redirect the admin right back into this page.
                    setTxConfigState(resp.redirect === '/server/deployer'
                        ? TxConfigState.Deployer
                        : TxConfigState.Ready);
                    return setLocation(resp.redirect, { replace: true });
                }
                setPageData(resp);
                setState((prev) => ({ ...prev, serverName: resp.serverName }));
                if (resp.skipServerName) setStepIndex(STEP_TYPE);
            },
        });
    }, []);

    const availableRecipes = useMemo(() => {
        if (!pageData) return [];
        if (!pageData.forceGameName) return pageData.bundledRecipes;
        return pageData.bundledRecipes.filter((r) => r.tags.includes(pageData.forceGameName as string));
    }, [pageData]);

    if (loadError) {
        return <SetupShell stepIndex={STEP_NAME}>
            <div className="flex flex-col items-center gap-3 py-10 text-center">
                <AlertTriangle className="size-8 text-destructive-inline" />
                <h3 className="text-lg font-semibold">{t('Could not open the setup wizard')}</h3>
                <p className="max-w-lg text-sm text-neutral-400">{loadError}</p>
                <Button variant="outline" onClick={reloadPanel}>{t('Try again')}</Button>
            </div>
        </SetupShell>;
    }
    if (!pageData) {
        return <SetupShell stepIndex={STEP_NAME}>
            <SetupSpinner label={t('Loading setup...')} />
        </SetupShell>;
    }

    //Helpers
    const clearStepFeedback = () => {
        setStepError(null);
        setStepErrorIsMarkdown(false);
        setPathSuggestion(null);
    };
    const goTo = (index: number) => {
        clearStepFeedback();
        setStepIndex(index);
    };
    const fail = (message: string, markdown = false) => {
        setStepError(message);
        setStepErrorIsMarkdown(markdown);
    };
    const assignDeployTarget = (templateName: string) => {
        const deploy = buildDeployName(templateName, pageData.dataPath);
        setState((prev) => ({ ...prev, deploymentID: deploy.id, targetPath: deploy.path }));
        setTargetPathLocked(true);
    };
    const handleRefresh = (resp: ValidationResp) => {
        if (!resp.refresh) return false;
        reloadPanel();
        return true;
    };

    //Step 1 - server name
    const submitName = () => {
        const name = state.serverName.trim();
        if (name.length < 1 || name.length > 18) {
            return fail(t('The name must have between 1 and 18 characters.'));
        }
        goTo(STEP_TYPE);
    };

    //Step 2 - deployment type
    const selectDeploymentType = (type: DeploymentType) => {
        setState((prev) => ({
            ...prev,
            deploymentType: type,
            framework: 'custom',
            recipeURL: '',
            recipeName: '',
            dataFolder: '',
            cfgFile: '',
        }));
        setDetectedCfg(false);
        if (type === 'custom') assignDeployTarget(state.serverName.trim());
        goTo(STEP_TEMPLATE);
    };

    //Step 3 - popular recipe pick
    const selectRecipe = (recipe: BundledRecipe) => {
        setState((prev) => ({
            ...prev,
            recipeURL: recipe.url,
            framework: recipe.framework,
            recipeName: recipe.name,
        }));
        assignDeployTarget(recipe.name);
        goTo(STEP_LOCATION);
    };

    //Step 3 - remote recipe url validation
    const submitRemoteRecipe = () => {
        const recipeURL = state.recipeURL.trim();
        if (!recipeURL.length) return fail(t('Enter the URL of the recipe you want to deploy.'));
        clearStepFeedback();
        setIsBusy(true);
        validateRecipeUrlApi({
            data: { recipeURL },
            timeout: ApiTimeout.LONG,
            finally: () => setIsBusy(false),
            error: (message) => fail(message),
            success: (resp) => {
                if (handleRefresh(resp)) return;
                if (!resp.success) {
                    return fail(`${resp.message ?? t('Unknown error')}\n${t('Make sure this is a valid Recipe URL.')}`);
                }
                setState((prev) => ({ ...prev, recipeName: resp.name ?? '' }));
                assignDeployTarget(resp.name ?? state.serverName.trim());
                goTo(STEP_LOCATION);
            },
        });
    };

    //Step 3 - existing server data folder validation
    const submitDataFolder = () => {
        const dataFolder = state.dataFolder.trim();
        if (!dataFolder.length) return fail(t('Enter the path of your server data folder.'));
        clearStepFeedback();
        setDetectedCfg(false);
        setIsBusy(true);
        validateDataFolderApi({
            data: { dataFolder },
            timeout: ApiTimeout.LONG,
            finally: () => setIsBusy(false),
            error: (message) => fail(message),
            success: (resp) => {
                if (handleRefresh(resp)) return;
                if (!resp.success) {
                    if (resp.suggestion) {
                        setPathSuggestion(resp.suggestion);
                        return fail(t('The path provided is invalid, but a nearby folder looks correct.'));
                    }
                    return fail(resp.message ?? t('Unknown error'));
                }
                setState((prev) => ({ ...prev, cfgFile: resp.detectedConfig ?? '' }));
                setDetectedCfg(!!resp.detectedConfig);
                goTo(STEP_LOCATION);
            },
        });
    };

    //Step 4 - deploy target path validation
    const submitDeployPath = () => {
        const deployPath = state.targetPath.trim();
        if (!deployPath.length) return fail(t('Enter the folder the server should be deployed to.'));
        clearStepFeedback();
        setIsBusy(true);
        validateDeployPathApi({
            data: { deployPath },
            timeout: ApiTimeout.LONG,
            finally: () => setIsBusy(false),
            error: (message) => fail(message),
            success: (resp) => {
                if (handleRefresh(resp)) return;
                if (!resp.success) return fail(resp.message ?? t('Unknown error'));
                goTo(STEP_LAUNCH);
            },
        });
    };

    //Step 4 - cfg file validation
    const submitCfgFile = () => {
        const cfgFile = state.cfgFile.trim();
        if (!cfgFile.length) return fail(t('Enter the path of your server config file.'));
        clearStepFeedback();
        setIsBusy(true);
        validateCfgApi({
            data: { dataFolder: state.dataFolder.trim(), cfgFile },
            timeout: ApiTimeout.LONG,
            finally: () => setIsBusy(false),
            error: (message) => fail(message),
            success: (resp) => {
                if (handleRefresh(resp)) return;
                if (!resp.success) return fail(resp.message ?? t('Unknown error'), !!resp.markdown);
                goTo(STEP_LAUNCH);
            },
        });
    };

    //Step 5 - save
    const performSave = () => {
        clearStepFeedback();
        const type = state.deploymentType;
        if (!type) return fail(t('Unknown deployment type.'));

        const payload: Record<string, unknown> = {
            name: state.serverName.trim(),
            type,
        };
        if (type === 'popular') {
            payload.isTrustedSource = true;
            payload.recipeURL = state.recipeURL;
            payload.framework = state.framework;
            payload.targetPath = state.targetPath.trim();
            payload.deploymentID = state.deploymentID;
        } else if (type === 'remote') {
            payload.isTrustedSource = false;
            payload.framework = 'custom';
            payload.recipeURL = state.recipeURL.trim();
            payload.targetPath = state.targetPath.trim();
            payload.deploymentID = state.deploymentID;
        } else if (type === 'custom') {
            payload.framework = 'custom';
            payload.targetPath = state.targetPath.trim();
            payload.deploymentID = state.deploymentID;
        } else {
            payload.dataFolder = state.dataFolder.trim();
            payload.cfgFile = state.cfgFile.trim();
        }

        setIsBusy(true);
        saveApi({
            data: payload,
            timeout: ApiTimeout.REALLY_LONG,
            finally: () => setIsBusy(false),
            error: (message) => fail(message),
            success: (resp) => {
                if (handleRefresh(resp)) return;
                if (!resp.success) {
                    return fail(
                        `${resp.message ?? t('Unknown error')}\n\n${t('Please refresh the page and start again.')}`,
                        !!resp.markdown,
                    );
                }
                setLocation(type === 'local' ? '/server/console-log' : '/server/deployer');
            },
        });
    };

    const isLocalFlow = state.deploymentType === 'local';
    const feedback = stepError && <StepError message={stepError} isMarkdown={stepErrorIsMarkdown} />;

    return <SetupShell stepIndex={stepIndex}>
        {stepIndex === STEP_NAME && <div>
            <StepHeading
                title={t('Name your server')}
                description={t('Pick a short, recognizable name. It is only used inside the panel.')}
            />
            <div className="max-w-md">
                <Label htmlFor="setup-name">{t('Server name')}</Label>
                <Input
                    id="setup-name"
                    className="mt-2"
                    autoFocus
                    maxLength={18}
                    placeholder="Happy Server"
                    value={state.serverName}
                    onChange={(e) => {
                        clearStepFeedback();
                        setState((prev) => ({ ...prev, serverName: e.target.value }));
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitName(); }}
                />
                <p className="mt-2 text-xs text-neutral-500">{t('Between 1 and 18 characters.')}</p>
            </div>
            {feedback}
            <StepActions>
                <Button onClick={submitName}>{t('Next')}<ArrowRight className="ml-2 size-4" /></Button>
            </StepActions>
        </div>}

        {stepIndex === STEP_TYPE && <div>
            <StepHeading
                title={t('Choose a starting point')}
                description={t('A curated recipe, data you already have, or a template of your own.')}
            />
            <div className="grid gap-3 sm:grid-cols-2">
                {DEPLOYMENT_CHOICES.map((choice) => <button
                    key={choice.type}
                    type="button"
                    onClick={() => selectDeploymentType(choice.type)}
                    className="group flex flex-col gap-3 rounded-2xl bg-white/5 p-5 text-left ring-1 ring-white/5 transition-colors hover:bg-white/10 hover:ring-brand-500/40"
                >
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/20">
                            <choice.icon className="size-5" />
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{t(choice.title)}</span>
                            {choice.badge && <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-brand-300">
                                {t(choice.badge)}
                            </span>}
                        </span>
                    </div>
                    <p className="text-sm leading-relaxed text-neutral-400">{t(choice.description)}</p>
                    <span className="mt-auto inline-flex items-center gap-1 text-xs uppercase tracking-widest text-neutral-500 transition-colors group-hover:text-brand-500">
                        {t('Select')}<ArrowRight className="size-3.5" />
                    </span>
                </button>)}
            </div>
            <StepActions>
                <Button variant="outline" onClick={() => goTo(STEP_NAME)}>
                    <ArrowLeft className="mr-2 size-4" />{t('Back')}
                </Button>
            </StepActions>
        </div>}

        {stepIndex === STEP_TEMPLATE && state.deploymentType === 'popular' && <div>
            <StepHeading
                title={t('Select a template')}
                description={t('These recipes ship with the panel and are deployed from a trusted source.')}
            />
            <div className="grid gap-3 sm:grid-cols-2">
                {availableRecipes.map((recipe) => <button
                    key={`${recipe.framework}:${recipe.url}`}
                    type="button"
                    onClick={() => selectRecipe(recipe)}
                    className="group flex flex-col gap-2 rounded-2xl bg-white/5 p-5 text-left ring-1 ring-white/5 transition-colors hover:bg-white/10 hover:ring-brand-500/40"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate font-semibold">{recipe.name}</p>
                            <p className="truncate text-xs uppercase tracking-widest text-neutral-500">{recipe.author}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            {/* `framework: 'none'` is a backend flag for the post-deploy
                                Character Management prompt, so only a real framework
                                earns a badge next to the game and genre tags. */}
                            {[...recipe.tags, ...(recipe.framework === 'none' ? [] : [recipe.framework])].map((tag) => <span
                                key={tag}
                                className={cn('rounded border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase', tagColorClass(tag))}
                            >{tag}</span>)}
                        </div>
                    </div>
                    <p className="line-clamp-2 text-sm text-neutral-400">{recipe.description}</p>
                </button>)}
                {!availableRecipes.length && <p className="text-sm text-neutral-400">
                    {t('No bundled template is available for this game.')}
                </p>}
            </div>
            {feedback}
            <StepActions>
                <Button variant="outline" onClick={() => goTo(STEP_TYPE)}>
                    <ArrowLeft className="mr-2 size-4" />{t('Back')}
                </Button>
            </StepActions>
        </div>}

        {stepIndex === STEP_TEMPLATE && state.deploymentType === 'remote' && <div>
            <StepHeading
                title={t('Remote recipe URL')}
                description={t('The URL of the remote recipe in the YAML format.')}
            />
            <div>
                <Label htmlFor="setup-recipe-url">{t('Recipe URL')}</Label>
                <Input
                    id="setup-recipe-url"
                    className="mt-2"
                    autoFocus
                    disabled={isBusy}
                    placeholder="https://raw.githubusercontent.com/citizenfx/txAdmin-recipes/main/default-fivem/recipe.yaml"
                    value={state.recipeURL}
                    onChange={(e) => {
                        clearStepFeedback();
                        setState((prev) => ({ ...prev, recipeURL: e.target.value }));
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitRemoteRecipe(); }}
                />
                <p className="mt-2 text-xs text-neutral-500">
                    {t('You can discover new recipes on the')}{' '}
                    <a
                        className="text-brand-500 underline-offset-2 hover:underline"
                        href="https://forum.cfx.re/c/development/releases/7"
                        target="_blank"
                        rel="noopener noreferrer"
                    >{t('cfx.re forum')}</a>.
                </p>
            </div>
            {feedback}
            <StepActions>
                <Button variant="outline" disabled={isBusy} onClick={() => goTo(STEP_TYPE)}>
                    <ArrowLeft className="mr-2 size-4" />{t('Back')}
                </Button>
                <Button disabled={isBusy} onClick={submitRemoteRecipe}>
                    {isBusy
                        ? <Loader2 className="mr-2 size-4 animate-spin" />
                        : <Wand2 className="mr-2 size-4" />}
                    {t('Validate recipe')}
                </Button>
            </StepActions>
        </div>}

        {stepIndex === STEP_TEMPLATE && state.deploymentType === 'custom' && <div>
            <StepHeading
                title={t('Custom recipe')}
                description={t('You will be prompted to write your recipe on the next page.')}
            />
            <div className="rounded-2xl bg-white/5 p-5 text-sm text-neutral-400">
                <p>{t('If you are developing your own recipes, we highly recommend checking:')}</p>
                <ul className="mt-3 flex flex-col gap-1">
                    <li>
                        <a
                            className="text-brand-500 underline-offset-2 hover:underline"
                            href="https://github.com/chyarofivem/cAdminPanel/blob/master/docs/recipe.md"
                            target="_blank"
                            rel="noopener noreferrer"
                        >{t('Recipe documentation')}</a>
                    </li>
                    <li>
                        <a
                            className="text-brand-500 underline-offset-2 hover:underline"
                            href="https://github.com/citizenfx/txAdmin-recipes"
                            target="_blank"
                            rel="noopener noreferrer"
                        >{t('Example recipes')}</a>
                    </li>
                </ul>
            </div>
            {feedback}
            <StepActions>
                <Button variant="outline" onClick={() => goTo(STEP_TYPE)}>
                    <ArrowLeft className="mr-2 size-4" />{t('Back')}
                </Button>
                <Button onClick={() => goTo(STEP_LOCATION)}>
                    {t('Next')}<ArrowRight className="ml-2 size-4" />
                </Button>
            </StepActions>
        </div>}

        {stepIndex === STEP_TEMPLATE && isLocalFlow && <div>
            <StepHeading
                title={t('Server data folder')}
                description={t('The folder that contains your resources and cache folders, also known as base folder.')}
            />
            <div>
                <Label htmlFor="setup-data-folder">{t('Server data folder')}</Label>
                <Input
                    id="setup-data-folder"
                    className="mt-2"
                    autoFocus
                    disabled={isBusy}
                    placeholder="C:/Users/Admin/Desktop/server01"
                    value={state.dataFolder}
                    onChange={(e) => {
                        clearStepFeedback();
                        setState((prev) => ({ ...prev, dataFolder: e.target.value }));
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitDataFolder(); }}
                />
                {pageData.hasCustomDataPath && <p className="mt-2 text-xs text-neutral-500">
                    {pageData.hostConfigSource}: {t('this path should start with')}{' '}
                    <code className="rounded bg-black/40 px-1.5 py-0.5 text-brand-300">{pageData.dataPath}</code>
                </p>}
            </div>
            {feedback}
            {pathSuggestion && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white/5 p-4">
                <div className="min-w-0 text-sm text-neutral-300">
                    {t('It looks like this path is the right one:')}{' '}
                    <code className="break-all rounded bg-black/40 px-1.5 py-0.5 text-brand-300">{pathSuggestion}</code>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        setState((prev) => ({ ...prev, dataFolder: pathSuggestion }));
                        clearStepFeedback();
                    }}
                >{t('Use this path')}</Button>
            </div>}
            <StepActions>
                <Button variant="outline" disabled={isBusy} onClick={() => goTo(STEP_TYPE)}>
                    <ArrowLeft className="mr-2 size-4" />{t('Back')}
                </Button>
                <Button disabled={isBusy} onClick={submitDataFolder}>
                    {isBusy
                        ? <Loader2 className="mr-2 size-4 animate-spin" />
                        : <FolderTree className="mr-2 size-4" />}
                    {t('Validate folder')}
                </Button>
            </StepActions>
        </div>}
        {/* SETUP_PAGE_CHUNK_2 */}
        {stepIndex === STEP_LOCATION && !isLocalFlow && <div>
            <StepHeading
                title={t('Deployment folder')}
                description={t('Where the server will be deployed to, with all its resources and configuration files.')}
            />
            <div>
                <Label htmlFor="setup-target-path">{t('Target folder')}</Label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                        id="setup-target-path"
                        disabled={isBusy || targetPathLocked}
                        placeholder={`${pageData.dataPath}/MyServer.base`}
                        value={state.targetPath}
                        onChange={(e) => {
                            clearStepFeedback();
                            setState((prev) => ({ ...prev, targetPath: e.target.value }));
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitDeployPath(); }}
                    />
                    {targetPathLocked && <Button
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setTargetPathLocked(false)}
                    >{t('Change path')}</Button>}
                </div>
                <p className="mt-2 text-xs text-neutral-500">{t('We strongly recommend using the suggested path.')}</p>
                {pageData.hasCustomDataPath && <p className="mt-1 text-xs text-neutral-500">
                    {pageData.hostConfigSource}: {t('this path must start with')}{' '}
                    <code className="rounded bg-black/40 px-1.5 py-0.5 text-brand-300">{pageData.dataPath}</code>
                </p>}
            </div>
            {feedback}
            <StepActions>
                <Button variant="outline" disabled={isBusy} onClick={() => goTo(STEP_TEMPLATE)}>
                    <ArrowLeft className="mr-2 size-4" />{t('Back')}
                </Button>
                <Button disabled={isBusy} onClick={submitDeployPath}>
                    {isBusy
                        ? <Loader2 className="mr-2 size-4 animate-spin" />
                        : <ArrowRight className="mr-2 size-4" />}
                    {t('Continue')}
                </Button>
            </StepActions>
        </div>}

        {stepIndex === STEP_LOCATION && isLocalFlow && <div>
            <StepHeading
                title={t('Server config file')}
                description={t('The path to your server config file, usually named server.cfg.')}
            />
            <div>
                <Label htmlFor="setup-cfg-file">{t('Config file')}</Label>
                <Input
                    id="setup-cfg-file"
                    className="mt-2"
                    autoFocus
                    disabled={isBusy}
                    placeholder="C:/Users/Admin/Desktop/server01/server.cfg"
                    value={state.cfgFile}
                    onChange={(e) => {
                        clearStepFeedback();
                        setDetectedCfg(false);
                        setState((prev) => ({ ...prev, cfgFile: e.target.value }));
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitCfgFile(); }}
                />
                <p className="mt-2 text-xs text-neutral-500">
                    {t('This can be absolute, or relative to the server data folder.')}
                </p>
                {detectedCfg && <p className="mt-2 text-sm font-medium text-success-inline">
                    {t('Config file detected! If this file is correct, just continue.')}
                </p>}
            </div>
            {feedback}
            <StepActions>
                <Button variant="outline" disabled={isBusy} onClick={() => goTo(STEP_TEMPLATE)}>
                    <ArrowLeft className="mr-2 size-4" />{t('Back')}
                </Button>
                <Button disabled={isBusy} onClick={submitCfgFile}>
                    {isBusy
                        ? <Loader2 className="mr-2 size-4 animate-spin" />
                        : <FileCog className="mr-2 size-4" />}
                    {t('Validate config')}
                </Button>
            </StepActions>
        </div>}

        {stepIndex === STEP_LAUNCH && <div>
            <StepHeading
                title={isLocalFlow ? t('Ready to launch') : t('Ready to deploy')}
                description={isLocalFlow
                    ? t('Save this configuration and start the server.')
                    : t('Save this configuration and continue to the deployer.')}
            />
            <dl className="divide-y divide-dashed divide-white/5 rounded-2xl bg-white/5 p-5">
                <SummaryRow label={t('Server name')} value={state.serverName.trim()} />
                <SummaryRow
                    label={t('Starting point')}
                    value={t(DEPLOYMENT_CHOICES.find((c) => c.type === state.deploymentType)?.title ?? '')}
                />
                {state.recipeName && <SummaryRow label={t('Template')} value={state.recipeName} />}
                {!isLocalFlow && <SummaryRow label={t('Target folder')} value={state.targetPath.trim()} />}
                {isLocalFlow && <SummaryRow label={t('Server data folder')} value={state.dataFolder.trim()} />}
                {isLocalFlow && <SummaryRow label={t('Config file')} value={state.cfgFile.trim()} />}
            </dl>
            {feedback}
            <StepActions>
                <Button variant="outline" disabled={isBusy} onClick={() => goTo(STEP_LOCATION)}>
                    <ArrowLeft className="mr-2 size-4" />{t('Back')}
                </Button>
                <Button disabled={isBusy} onClick={performSave}>
                    {isBusy
                        ? <Loader2 className="mr-2 size-4 animate-spin" />
                        : <Rocket className="mr-2 size-4" />}
                    {isLocalFlow ? t('Save & start server') : t('Save & continue setup')}
                </Button>
            </StepActions>
        </div>}
    </SetupShell>;
}


function SummaryRow({ label, value }: { label: string, value: string }) {
    return <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <dt className="text-xs uppercase tracking-widest text-neutral-500">{label}</dt>
        <dd className="break-all text-sm text-neutral-200 sm:text-right">{value || '—'}</dd>
    </div>;
}


/**
 * Backend validation errors can come back as markdown (eg. the cfg file check),
 * which the legacy page rendered through marked.js.
 */
function StepError({ message, isMarkdown }: { message: string, isMarkdown: boolean }) {
    return <div className="mt-4 flex gap-3 rounded-2xl bg-destructive/10 p-4 text-sm ring-1 ring-destructive/30">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive-inline" />
        <div className="min-w-0 break-words">
            {isMarkdown
                ? <div className="flex flex-col gap-2"><Markdown>{message}</Markdown></div>
                : <p className="whitespace-pre-line">{message}</p>}
        </div>
    </div>;
}
