import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import Editor, { loader, type BeforeMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { navigate } from 'wouter/use-browser-location';
import { useLocation } from 'wouter';
import { TxConfigState } from '@shared/enums';
import type { DeployerActionResp, DeployerData, DeployerDataResp } from '@shared/deployerApiTypes';
import { PageHeader } from '@/components/page-header';
import CopyRow from '@/components/CopyRow';
import MarkdownProse from '@/components/MarkdownProse';
import TxAnchor from '@/components/TxAnchor';
import { txToast } from '@/components/TxToaster';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useSetTxConfigState } from '@/hooks/status';
import { t } from '@/lib/i18n';
import { editorThemeColors } from '@/lib/monacoTheme';
import { cn } from '@/lib/utils';
import { WizardSteps } from '@/pages/Setup/SetupShell';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

const configureMonaco: BeforeMount = monacoApi => {
    if (!monacoApi.languages.getLanguages().some(language => language.id === 'cadmin-yaml')) {
        monacoApi.languages.register({ id: 'cadmin-yaml' });
        monacoApi.languages.setMonarchTokensProvider('cadmin-yaml', {
            tokenizer: { root: [
                [/#.*$/, 'comment'],
                [/^\s*[\w$.-]+(?=\s*:)/, 'type.identifier'],
                [/'[^']*'|"([^"\\]|\\.)*"/, 'string'],
                [/\b(?:true|false|null)\b/, 'keyword'],
                [/[-+]?(?:\.\d+|\d+\.?\d*)/, 'number'],
            ] },
        });
    }
    if (!monacoApi.languages.getLanguages().some(language => language.id === 'cadmin-fivem-cfg')) {
        monacoApi.languages.register({ id: 'cadmin-fivem-cfg' });
        monacoApi.languages.setLanguageConfiguration('cadmin-fivem-cfg', { comments: { lineComment: '#' } });
        monacoApi.languages.setMonarchTokensProvider('cadmin-fivem-cfg', {
            ignoreCase: true,
            tokenizer: { root: [
                [/#.*$/, 'comment'],
                [/'[^']*'|"([^"\\]|\\.)*"/, 'string'],
                [/\b(?:start|stop|ensure|restart|refresh|exec|set|seta|setr|sets)\b/, 'keyword.control'],
                [/\b(?:endpoint_add_tcp|endpoint_add_udp|sv_hostname|sv_licenseKey|sv_maxClients|add_ace|add_principal)\b/, 'type.identifier'],
                [/[-+]?(?:\.\d+|\d+\.?\d*)/, 'number'],
            ] },
        });
    }
    monacoApi.editor.defineTheme('cadmin-deployer', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '71717a' },
            { token: 'type.identifier', foreground: '60a5fa' },
            { token: 'keyword', foreground: 'c084fc' },
            { token: 'keyword.control', foreground: 'c084fc' },
            { token: 'string', foreground: '86efac' },
        ],
        colors: editorThemeColors,
    });
};

const steps = [
    { id: 'review', label: 'Review recipe' },
    { id: 'input', label: 'Configuration' },
    { id: 'run', label: 'Install' },
    { id: 'configure', label: 'Server CFG' },
] as const;

type InputState = {
    svLicense: string;
    dbHost: string;
    dbPort: string;
    dbUsername: string;
    dbPassword: string;
    dbName: string;
    dbDelete: boolean;
    custom: Record<string, string>;
};

function EditorShell({ value, onChange, language, height = '26rem' }: {
    value: string;
    onChange: (value: string) => void;
    language: string;
    height?: string;
}) {
    return <div className="overflow-hidden rounded-lg bg-sunken" style={{ height }}>
        <Editor
            beforeMount={configureMonaco}
            language={language}
            theme="cadmin-deployer"
            value={value}
            onChange={next => onChange(next ?? '')}
            loading={<p role="status" className="text-sm text-muted-foreground">{t('Starting editor...')}</p>}
            options={{
                automaticLayout: true,
                cursorBlinking: 'smooth',
                fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", Consolas, monospace',
                fontLigatures: true,
                fontSize: 13,
                lineHeight: 18,
                minimap: { enabled: false },
                padding: { top: 10, bottom: 10 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                tabSize: 4,
                wordWrap: 'on',
            }}
        />
    </div>;
}

export default function DeployerPage() {
    const fetcher = useAuthedFetcher();
    const openConfirmDialog = useOpenConfirmDialog();
    const [location] = useLocation();
    const setTxConfigState = useSetTxConfigState();
    const [recipeDraft, setRecipeDraft] = useState('');
    const [cfgDraft, setCfgDraft] = useState('');
    const [inputs, setInputs] = useState<InputState>();
    const [initializedKey, setInitializedKey] = useState('');
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<{ message: string; markdown?: boolean }>();
    const [cadminDecision, setCadminDecision] = useState<string>();
    //The actions that end the wizard pick their own destination, so the redirect below
    //must not race them and drop the admin somewhere else.
    const ownsNavigation = useRef(false);

    const deployerSWR = useSWR('/deployer/data', async url => {
        const response = await fetcher<DeployerDataResp>(url);
        if ('error' in response) throw new Error(response.error);
        return response;
    }, {
        revalidateOnFocus: false,
        refreshInterval: data => data && 'step' in data && data.step === 'run' ? 1000 : 0,
    });
    const data = deployerSWR.data && 'step' in deployerSWR.data ? deployerSWR.data : undefined;

    useEffect(() => {
        const redirect = deployerSWR.data && 'redirect' in deployerSWR.data ? deployerSWR.data.redirect : undefined;
        if (!redirect) return;
        //This route answers with the live config state while the cached one can still say
        //`Deployer` for a few seconds. Correcting it before leaving stops the dashboard from
        //sending us straight back here, which looped until react gave up on the whole panel.
        setTxConfigState(redirect === '/server/setup' ? TxConfigState.Setup : TxConfigState.Ready);
        if (ownsNavigation.current || location === redirect) return;
        navigate(redirect, { replace: true });
    }, [deployerSWR.data, location, setTxConfigState]);

    useEffect(() => {
        if (!data) return;
        const key = `${data.deploymentID}:${data.step}`;
        if (key === initializedKey) return;
        if (data.step === 'review') setRecipeDraft(data.recipe.raw);
        if (data.step === 'configure') setCfgDraft(data.serverCFG);
        if (data.step === 'input') setInputs({
            svLicense: data.defaults.license,
            dbHost: data.defaults.mysqlHost,
            dbPort: data.defaults.mysqlPort,
            dbUsername: data.defaults.mysqlUser,
            dbPassword: data.defaults.mysqlPassword,
            dbName: data.defaults.mysqlDatabase,
            dbDelete: true,
            custom: Object.fromEntries(data.inputVars.map(variable => [variable.name, variable.value])),
        });
        setInitializedKey(key);
        setActionError(undefined);
    }, [data, initializedKey]);

    const postAction = async (action: string, body: Record<string, unknown> = {}) => {
        setBusy(true);
        setActionError(undefined);
        try {
            const response = await fetcher<DeployerActionResp>(`/deployer/recipe/${action}`, { method: 'POST', body });
            if (!response.success) {
                if (response.refresh) await deployerSWR.mutate();
                setActionError({ message: response.message || t('The deployer action failed.'), markdown: response.markdown });
                return response;
            }
            await deployerSWR.mutate();
            return response;
        } catch (error) {
            setActionError({ message: error instanceof Error ? error.message : t('The deployer action failed.') });
        } finally {
            setBusy(false);
        }
    };

    const cancel = () => openConfirmDialog({
        title: t('Exit the setup wizard?'),
        message: t('The active deployment will be discarded. Files already written to the target folder may remain.'),
        cancelLabel: t('Keep working'),
        actionLabel: t('Exit wizard'),
        confirmBtnVariant: 'destructive',
        onConfirm: async () => {
            ownsNavigation.current = true;
            const response = await postAction('cancel');
            if (response?.success) navigate('/server/setup', { replace: true });
            else ownsNavigation.current = false;
        },
    });

    const confirmRecipe = async () => {
        if (recipeDraft.includes('This is just a placeholder')) {
            setActionError({ message: t('Remove the placeholder warning before continuing.') });
            return;
        }
        if (recipeDraft.length < 256) {
            setActionError({ message: t('The recipe is unusually small. Restore its contents or exit the wizard.') });
            return;
        }
        await postAction('confirmRecipe', { recipe: recipeDraft.replace(/\t/g, '    ') });
    };

    const runRecipe = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!data || data.step !== 'input' || !inputs) return;
        const body: Record<string, unknown> = { svLicense: inputs.svLicense, ...inputs.custom };
        if (data.requireDBConfig) Object.assign(body, {
            dbHost: inputs.dbHost,
            dbPort: inputs.dbPort,
            dbUsername: inputs.dbUsername,
            dbPassword: inputs.dbPassword,
            dbName: inputs.dbName || data.deploymentID,
            dbDelete: inputs.dbDelete,
        });
        await postAction('setVariables', body);
    };

    const commit = async () => {
        ownsNavigation.current = true;
        if (cfgDraft.length < 256) {
            ownsNavigation.current = false;
            setActionError({ message: t('The server CFG is unusually small and cannot be saved from the deployer.') });
            return;
        }
        if (cfgDraft.includes('sv_licenseKey "changeme"')) {
            ownsNavigation.current = false;
            setActionError({ message: t('Replace the placeholder server registration key before continuing.') });
            return;
        }
        const response = await postAction('commit', { serverCFG: cfgDraft });
        if (!response?.success) {
            ownsNavigation.current = false;
            return;
        }
        if (response.installCadminDialog) setCadminDecision(response.framework || 'supported framework');
        else navigate('/server/console-log', { replace: true });
    };

    const finishCadmin = async (install: boolean) => {
        ownsNavigation.current = true;
        const response = await postAction('finishCadmin', { install });
        if (response?.success) {
            setCadminDecision(undefined);
            navigate('/server/console-log', { replace: true });
        } else {
            ownsNavigation.current = false;
        }
    };

    const stepIndex = data ? steps.findIndex(step => step.id === data.step) : 0;
    const exitButton = <Button type="button" variant="outline-destructive" onClick={cancel}>{t('Exit wizard')}</Button>;
    return <div className="w-full max-w-5xl pb-8">
        <PageHeader
            title={t('Setup Wizard')}
            subtitle={data ? t('Step {step} of 4', { step: stepIndex + 1 }) : undefined}
        />

        <div className="flex flex-col gap-6">
            {deployerSWR.isLoading && <p role="status" className="text-sm text-muted-foreground">{t('Loading deployment...')}</p>}
            {deployerSWR.error && <div className="flex flex-col items-start gap-3">
                <Alert variant="destructive"><AlertDescription>{deployerSWR.error.message}</AlertDescription></Alert>
                <Button variant="secondary" onClick={() => void deployerSWR.mutate()}>{t('Try again')}</Button>
            </div>}

            {data && <WizardSteps labels={steps.map(item => item.label)} current={stepIndex} />}
            {data && actionError && <Alert variant="destructive">
                <AlertTitle>{t('Unable to continue')}</AlertTitle>
                <AlertDescription>{actionError.markdown ? <MarkdownProse md={actionError.message} isSmall /> : actionError.message}</AlertDescription>
            </Alert>}

            {data?.step === 'review' && <section className="flex flex-col gap-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="break-words text-base font-semibold leading-tight text-white">{data.recipe.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{t('By {author}', { author: data.recipe.author || t('Unknown author') })}</p>
                    </div>
                    <Badge variant={data.recipe.isTrustedSource ? 'success' : 'danger'}>
                        {data.recipe.isTrustedSource ? t('Trusted source') : t('Untrusted source')}
                    </Badge>
                </div>
                {data.recipe.description && <p className="text-sm text-body">{data.recipe.description}</p>}
                {!data.recipe.isTrustedSource && <Alert variant="warning">
                    <AlertTitle>{t('Review every task')}</AlertTitle>
                    <AlertDescription>{t('This recipe came from an untrusted source. Continue only when you recognize and trust its contents.')}</AlertDescription>
                </Alert>}
                <EditorShell value={recipeDraft} onChange={setRecipeDraft} language="cadmin-yaml" />
                <div className="flex flex-wrap items-center gap-3">
                    {exitButton}
                    <Button disabled={busy} onClick={() => void confirmRecipe()}>{t('Continue')}</Button>
                </div>
            </section>}

            {data?.step === 'input' && inputs && <form onSubmit={runRecipe} className="flex flex-col gap-6">
                <div>
                    <h2 className="text-base font-semibold leading-tight text-white">{t('Deployment configuration')}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t('Supply the values used while installing this server.')}</p>
                </div>
                {data.defaults.autofilled && <Alert variant="info">
                    <AlertTitle>{t('Host defaults applied')}</AlertTitle>
                    <AlertDescription>{t('Some values were provided by {source}. Review them before starting.', { source: data.hostConfigSource })}</AlertDescription>
                </Alert>}
                <div className="flex max-w-xl flex-col gap-2">
                    <Label htmlFor="deployer-license">{t('Server registration key')}</Label>
                    <Input id="deployer-license" className="font-mono" required maxLength={86} type="password" autoComplete="off" value={inputs.svLicense} onChange={event => setInputs({ ...inputs, svLicense: event.target.value.trim() })} placeholder="cfxk_xxxxxxxxxxxxxxxxxxxx_xxxxx" />
                    <p className="text-dense text-muted-foreground">{t('Create or manage keys in the')} <TxAnchor href="https://portal.cfx.re/servers/registration-keys">Cfx.re Portal</TxAnchor>.</p>
                </div>

                {data.requireDBConfig && <section className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-white">{t('Database')}</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label={t('Host')} value={inputs.dbHost} required onChange={dbHost => setInputs({ ...inputs, dbHost })} />
                        <Field label={t('Port')} value={inputs.dbPort} type="number" required onChange={dbPort => setInputs({ ...inputs, dbPort })} />
                        <Field label={t('Username')} value={inputs.dbUsername} required onChange={dbUsername => setInputs({ ...inputs, dbUsername })} />
                        <Field label={t('Password')} value={inputs.dbPassword} type="password" onChange={dbPassword => setInputs({ ...inputs, dbPassword })} />
                        <Field label={t('Database name')} value={inputs.dbName} onChange={dbName => setInputs({ ...inputs, dbName })} />
                        <div className="flex min-h-11 items-center justify-between gap-4 md:self-end">
                            <div>
                                <Label htmlFor="deployer-db-delete">{t('Replace existing database')}</Label>
                                <p className="mt-1 text-dense text-danger-text">{t('Deletes a database with the same name.')}</p>
                            </div>
                            <Switch id="deployer-db-delete" checked={inputs.dbDelete} onCheckedChange={dbDelete => setInputs({ ...inputs, dbDelete })} />
                        </div>
                    </div>
                </section>}

                {data.inputVars.length > 0 && <section className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-white">{t('Recipe variables')}</h3>
                    {data.inputVars.map(variable => <Field key={variable.name} label={variable.name} description={variable.description} value={inputs.custom[variable.name] ?? ''} onChange={value => setInputs({ ...inputs, custom: { ...inputs.custom, [variable.name]: value } })} />)}
                </section>}
                <div className="flex flex-wrap items-center gap-3">
                    {exitButton}
                    <Button type="submit" disabled={busy}>{t('Run recipe')}</Button>
                </div>
            </form>}

            {data?.step === 'run' && <section className="flex flex-col gap-6">
                <h2 className="text-base font-semibold leading-tight text-white">{data.status === 'failed' ? t('Deployment failed') : t('Installing server')}</h2>
                <CopyRow value={data.deployPath} />
                <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-dense">
                        <span className="text-muted-foreground">{data.status === 'failed' ? t('Stopped') : t('Progress')}</span>
                        <span className="tabular-nums text-white">{data.progress}%</span>
                    </div>
                    <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-raise-2"
                        role="progressbar"
                        aria-label={t('Progress')}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={data.progress}
                    >
                        <div className={cn('h-full rounded-full transition-[width] duration-150', data.status === 'failed' ? 'bg-danger' : 'bg-accent')} style={{ width: `${Math.max(data.progress, 2)}%` }} />
                    </div>
                </div>
                <pre className="max-h-[30rem] min-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-sunken p-4 font-mono text-xs leading-5 text-body">{data.log || t('Preparing deployment...')}</pre>
                {data.status === 'failed' && <div className="flex flex-wrap items-center gap-3">{exitButton}</div>}
            </section>}

            {data?.step === 'configure' && <section className="flex flex-col gap-6">
                <div>
                    <h2 className="text-base font-semibold leading-tight text-white">{t('Review server.cfg')}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t('Make final server configuration changes, then save and launch.')}</p>
                </div>
                <EditorShell value={cfgDraft} onChange={setCfgDraft} language="cadmin-fivem-cfg" height="34rem" />
                <div className="flex flex-wrap items-center gap-3">
                    {exitButton}
                    <Button disabled={busy} onClick={() => void commit()}>{t('Save and run server')}</Button>
                </div>
            </section>}
        </div>

        <Dialog open={Boolean(cadminDecision)} onOpenChange={open => { if (!open && !busy) setCadminDecision(undefined); }}>
            <DialogContent>
                <DialogHeader><DialogTitle>{t('Add Character Management?')}</DialogTitle><DialogDescription>{t('Install and configure the cAdminPanel resource for {framework}?', { framework: cadminDecision?.toUpperCase() ?? '' })}</DialogDescription></DialogHeader>
                <p className="text-sm text-muted-foreground">{t('The resource, API secret, framework, and bridge URL will be configured automatically. You can also install it later from Settings.')}</p>
                <DialogFooter>
                    <Button variant="secondary" disabled={busy} onClick={() => void finishCadmin(false)}>{t('Not now')}</Button>
                    <Button disabled={busy} onClick={() => void finishCadmin(true)}>{t('Install Character Management')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>;
}

function Field({ label, description, value, onChange, type = 'text', required = false }: {
    label: string;
    description?: string;
    value: string;
    onChange: (value: string) => void;
    type?: React.HTMLInputTypeAttribute;
    required?: boolean;
}) {
    const id = useMemo(() => `deployer-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, [label]);
    return <div className="flex flex-col gap-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} required={required} autoComplete="off" value={value} onChange={event => onChange(event.target.value)} />{description && <p className="text-dense text-muted-foreground">{description}</p>}</div>;
}
