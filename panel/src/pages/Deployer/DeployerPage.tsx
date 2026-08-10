import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Editor, { loader, type BeforeMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import {
    AlertTriangle, Check, ChevronRight, Circle, Code2, Database, FolderOpen,
    Loader2, Play, Rocket, Settings2, ShieldCheck, TerminalSquare, X,
} from 'lucide-react';
import { navigate } from 'wouter/use-browser-location';
import type { DeployerActionResp, DeployerData, DeployerDataResp } from '@shared/deployerApiTypes';
import { PageHeader } from '@/components/page-header';
import MarkdownProse from '@/components/MarkdownProse';
import TxAnchor from '@/components/TxAnchor';
import { txToast } from '@/components/TxToaster';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { useAuthedFetcher } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

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
        colors: {
            'editor.background': '#0b0d11',
            'editorGutter.background': '#0f1116',
            'editorLineNumber.foreground': '#4f515b',
            'editorLineNumber.activeForeground': '#a1a1aa',
            'editor.selectionBackground': '#3b82f633',
            'editor.lineHighlightBackground': '#ffffff08',
        },
    });
};

const steps = [
    { id: 'review', label: 'Review recipe', detail: 'Inspect the deployment plan' },
    { id: 'input', label: 'Configuration', detail: 'Add server credentials' },
    { id: 'run', label: 'Install', detail: 'Deploy files and database' },
    { id: 'configure', label: 'Server CFG', detail: 'Review and launch' },
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

function StepProgress({ step }: { step: DeployerData['step'] }) {
    const activeIndex = steps.findIndex(item => item.id === step);
    return <ol className="mb-5 grid gap-2 md:grid-cols-4">
        {steps.map((item, index) => {
            const complete = index < activeIndex;
            const active = index === activeIndex;
            return <li key={item.id} className={cn(
                'flex items-center gap-3 rounded-xl border p-3 transition-colors duration-300',
                active ? 'border-brand-500/30 bg-brand-500/10' : complete ? 'border-emerald-500/15 bg-emerald-500/[0.05]' : 'border-white/5 bg-white/[0.025]',
            )}>
                <span className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    active ? 'border-brand-500/40 bg-brand-500/15 text-brand-300' : complete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-zinc-600',
                )}>{complete ? <Check className="size-3.5" /> : index + 1}</span>
                <span className="min-w-0"><strong className={cn('block truncate text-xs', active || complete ? 'text-zinc-200' : 'text-zinc-500')}>{t(item.label)}</strong><small className="block truncate text-[10px] text-zinc-600">{t(item.detail)}</small></span>
            </li>;
        })}
    </ol>;
}

function EditorShell({ value, onChange, language, height = '26rem' }: {
    value: string;
    onChange: (value: string) => void;
    language: string;
    height?: string;
}) {
    return <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0d11]" style={{ height }}>
        <Editor
            beforeMount={configureMonaco}
            language={language}
            theme="cadmin-deployer"
            value={value}
            onChange={next => onChange(next ?? '')}
            loading={<div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />{t('Starting editor...')}</div>}
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
    const [recipeDraft, setRecipeDraft] = useState('');
    const [cfgDraft, setCfgDraft] = useState('');
    const [inputs, setInputs] = useState<InputState>();
    const [initializedKey, setInitializedKey] = useState('');
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<{ message: string; markdown?: boolean }>();
    const [cadminDecision, setCadminDecision] = useState<string>();

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
        if (deployerSWR.data && 'redirect' in deployerSWR.data) navigate(deployerSWR.data.redirect, { replace: true });
    }, [deployerSWR.data]);

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
            const response = await postAction('cancel');
            if (response?.success) navigate('/server/setup', { replace: true });
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
        if (cfgDraft.length < 256) {
            setActionError({ message: t('The server CFG is unusually small and cannot be saved from the deployer.') });
            return;
        }
        if (cfgDraft.includes('sv_licenseKey "changeme"')) {
            setActionError({ message: t('Replace the placeholder server registration key before continuing.') });
            return;
        }
        const response = await postAction('commit', { serverCFG: cfgDraft });
        if (!response?.success) return;
        if (response.installCadminDialog) setCadminDecision(response.framework || 'supported framework');
        else navigate('/server/console-log', { replace: true });
    };

    const finishCadmin = async (install: boolean) => {
        const response = await postAction('finishCadmin', { install });
        if (response?.success) {
            setCadminDecision(undefined);
            navigate('/server/console-log', { replace: true });
        }
    };

    const stepIndex = data ? steps.findIndex(step => step.id === data.step) : 0;
    return <div className="pb-8">
        <PageHeader title={t('Setup Wizard')} icon={<Rocket className="size-6" />}>
            {data && <Badge variant="outline" className="border-brand-500/20 bg-brand-500/10 text-brand-300">{t('Step {step} of 4', { step: stepIndex + 1 })}</Badge>}
        </PageHeader>

        {deployerSWR.isLoading && <Card><CardContent className="flex items-center justify-center gap-2 p-14 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />{t('Loading deployment...')}</CardContent></Card>}
        {deployerSWR.error && <Card className="border-red-500/20 bg-red-500/10"><CardContent className="p-6 text-sm text-red-300"><p>{deployerSWR.error.message}</p><Button variant="outline" className="mt-4" onClick={() => void deployerSWR.mutate()}>{t('Try again')}</Button></CardContent></Card>}

        {data && <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
            <StepProgress step={data.step} />
            {actionError && <Alert variant="destructive" className="mb-4"><AlertTriangle className="size-4" /><AlertTitle>{t('Unable to continue')}</AlertTitle><AlertDescription>{actionError.markdown ? <MarkdownProse md={actionError.message} isSmall /> : actionError.message}</AlertDescription></Alert>}

            {data.step === 'review' && <Card className="overflow-hidden border-white/10">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 p-5">
                    <div><p className="text-xs uppercase tracking-[0.18em] text-brand-500">{t('Deployment recipe')}</p><h2 className="mt-1 text-xl font-semibold">{data.recipe.name}</h2><p className="mt-1 text-sm text-zinc-500">{t('By {author}', { author: data.recipe.author || t('Unknown author') })}</p></div>
                    <Badge variant="outline" className={data.recipe.isTrustedSource ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}>{data.recipe.isTrustedSource ? t('Trusted source') : t('Untrusted source')}</Badge>
                </div>
                <CardContent className="space-y-4 p-5">
                    {data.recipe.description && <p className="text-sm leading-relaxed text-zinc-400">{data.recipe.description}</p>}
                    {!data.recipe.isTrustedSource && <Alert variant="warning"><AlertTriangle className="size-4" /><AlertTitle>{t('Review every task')}</AlertTitle><AlertDescription>{t('This recipe came from an untrusted source. Continue only when you recognize and trust its contents.')}</AlertDescription></Alert>}
                    <EditorShell value={recipeDraft} onChange={setRecipeDraft} language="cadmin-yaml" />
                    <div className="flex flex-wrap justify-between gap-3"><Button variant="outline-destructive" onClick={cancel}><X className="mr-2 size-4" />{t('Exit wizard')}</Button><Button disabled={busy} onClick={() => void confirmRecipe()}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ChevronRight className="mr-2 size-4" />}{t('Continue')}</Button></div>
                </CardContent>
            </Card>}

            {data.step === 'input' && inputs && <form onSubmit={runRecipe}>
                <Card className="overflow-hidden border-white/10">
                    <div className="border-b border-white/5 p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Settings2 className="size-5 text-brand-500" />{t('Deployment configuration')}</h2><p className="mt-1 text-sm text-zinc-500">{t('Supply the values used while installing this server.')}</p></div>
                    <CardContent className="space-y-5 p-5">
                        {data.defaults.autofilled && <Alert variant="info"><ShieldCheck className="size-4" /><AlertTitle>{t('Host defaults applied')}</AlertTitle><AlertDescription>{t('Some values were provided by {source}. Review them before starting.', { source: data.hostConfigSource })}</AlertDescription></Alert>}
                        <div className="space-y-2"><Label htmlFor="deployer-license">{t('Server registration key')}</Label><Input id="deployer-license" required maxLength={86} type="password" autoComplete="off" value={inputs.svLicense} onChange={event => setInputs({ ...inputs, svLicense: event.target.value.trim() })} placeholder="cfxk_xxxxxxxxxxxxxxxxxxxx_xxxxx" /><p className="text-xs text-zinc-500">{t('Create or manage keys in the')} <TxAnchor href="https://portal.cfx.re/servers/registration-keys">Cfx.re Portal</TxAnchor>.</p></div>

                        {data.requireDBConfig && <section className="rounded-xl border border-white/5 bg-black/10 p-4">
                            <h3 className="mb-4 flex items-center gap-2 font-medium"><Database className="size-4 text-brand-500" />{t('Database')}</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label={t('Host')} value={inputs.dbHost} required onChange={dbHost => setInputs({ ...inputs, dbHost })} />
                                <Field label={t('Port')} value={inputs.dbPort} type="number" required onChange={dbPort => setInputs({ ...inputs, dbPort })} />
                                <Field label={t('Username')} value={inputs.dbUsername} required onChange={dbUsername => setInputs({ ...inputs, dbUsername })} />
                                <Field label={t('Password')} value={inputs.dbPassword} type="password" onChange={dbPassword => setInputs({ ...inputs, dbPassword })} />
                                <Field label={t('Database name')} value={inputs.dbName} onChange={dbName => setInputs({ ...inputs, dbName })} />
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-2"><div><Label>{t('Replace existing database')}</Label><p className="mt-1 text-xs text-zinc-500">{t('Deletes a database with the same name.')}</p></div><Switch checked={inputs.dbDelete} onCheckedChange={dbDelete => setInputs({ ...inputs, dbDelete })} /></div>
                            </div>
                        </section>}

                        {data.inputVars.length > 0 && <section className="space-y-4 rounded-xl border border-white/5 bg-black/10 p-4"><h3 className="font-medium">{t('Recipe variables')}</h3>{data.inputVars.map(variable => <Field key={variable.name} label={variable.name} description={variable.description} value={inputs.custom[variable.name] ?? ''} onChange={value => setInputs({ ...inputs, custom: { ...inputs.custom, [variable.name]: value } })} />)}</section>}
                        <div className="flex flex-wrap justify-between gap-3"><Button type="button" variant="outline-destructive" onClick={cancel}><X className="mr-2 size-4" />{t('Exit wizard')}</Button><Button type="submit" disabled={busy}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}{t('Run recipe')}</Button></div>
                    </CardContent>
                </Card>
            </form>}

            {data.step === 'run' && <Card className="overflow-hidden border-white/10">
                <div className="border-b border-white/5 p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><TerminalSquare className="size-5 text-brand-500" />{data.status === 'failed' ? t('Deployment failed') : t('Installing server')}</h2><p className="mt-1 flex items-center gap-2 break-all text-xs text-zinc-500"><FolderOpen className="size-3.5 shrink-0" />{data.deployPath}</p></div>
                <CardContent className="space-y-5 p-5">
                    <div><div className="mb-2 flex justify-between text-xs text-zinc-500"><span>{data.status === 'failed' ? t('Stopped') : t('Progress')}</span><span>{data.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><div className={cn('h-full rounded-full transition-[width] duration-500', data.status === 'failed' ? 'bg-red-500' : 'bg-brand-500')} style={{ width: `${Math.max(data.progress, 2)}%` }} /></div></div>
                    <pre className="max-h-[30rem] min-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-[#090b0e] p-4 font-mono text-xs leading-5 text-zinc-400">{data.log || t('Preparing deployment...')}</pre>
                    {data.status === 'failed' && <div className="flex justify-end"><Button variant="outline-destructive" onClick={cancel}><X className="mr-2 size-4" />{t('Exit wizard')}</Button></div>}
                </CardContent>
            </Card>}

            {data.step === 'configure' && <Card className="overflow-hidden border-white/10">
                <div className="border-b border-white/5 p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Code2 className="size-5 text-brand-500" />{t('Review server.cfg')}</h2><p className="mt-1 text-sm text-zinc-500">{t('Make final server configuration changes, then save and launch.')}</p></div>
                <CardContent className="space-y-4 p-5"><EditorShell value={cfgDraft} onChange={setCfgDraft} language="cadmin-fivem-cfg" height="34rem" /><div className="flex flex-wrap justify-between gap-3"><Button variant="outline-destructive" onClick={cancel}><X className="mr-2 size-4" />{t('Exit wizard')}</Button><Button disabled={busy} onClick={() => void commit()}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Rocket className="mr-2 size-4" />}{t('Save and run server')}</Button></div></CardContent>
            </Card>}
        </div>}

        <Dialog open={Boolean(cadminDecision)} onOpenChange={open => { if (!open && !busy) setCadminDecision(undefined); }}>
            <DialogContent>
                <DialogHeader><DialogTitle>{t('Add Character Management?')}</DialogTitle><DialogDescription>{t('Install and configure the cAdminPanel resource for {framework}?', { framework: cadminDecision?.toUpperCase() ?? '' })}</DialogDescription></DialogHeader>
                <p className="text-sm text-zinc-400">{t('The resource, API secret, framework, and bridge URL will be configured automatically. You can also install it later from Settings.')}</p>
                <DialogFooter><Button variant="outline" disabled={busy} onClick={() => void finishCadmin(false)}>{t('Not now')}</Button><Button disabled={busy} onClick={() => void finishCadmin(true)}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Rocket className="mr-2 size-4" />}{t('Install Character Management')}</Button></DialogFooter>
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
    return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} required={required} autoComplete="off" value={value} onChange={event => onChange(event.target.value)} />{description && <p className="text-xs leading-relaxed text-zinc-500">{description}</p>}</div>;
}
