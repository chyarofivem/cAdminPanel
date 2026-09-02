import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Editor, { loader, type BeforeMount, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { AlertTriangle, FileCode2, Loader2, RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { txToast } from '@/components/TxToaster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { useAuthedFetcher } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import { editorThemeColors } from '@/lib/monacoTheme';

self.MonacoEnvironment = {
    getWorker: () => new EditorWorker(),
};
loader.config({ monaco });

type CfgDataResponse = {
    success: true;
    data: { contents: string; fileName: string };
} | {
    success: false;
    error: 'permission_denied' | 'not_configured' | 'read_failed';
};

type SaveResponse = {
    type: 'success' | 'warning' | 'danger';
    code?: 'permission_denied' | 'not_configured' | 'save_failed' | 'validation_errors' | 'saved_with_warnings' | 'saved';
    message?: string;
    details?: string;
    markdown?: boolean;
};

const loadErrors: Record<'permission_denied' | 'not_configured' | 'read_failed', string> = {
    permission_denied: 'Only the master account can open the CFG editor.',
    not_configured: 'Configure the server data path before editing the CFG file.',
    read_failed: 'The configured CFG file could not be read.',
};

const configureMonaco: BeforeMount = (monacoApi) => {
    if (!monacoApi.languages.getLanguages().some(language => language.id === 'fivem-cfg')) {
        monacoApi.languages.register({ id: 'fivem-cfg' });
        monacoApi.languages.setLanguageConfiguration('fivem-cfg', {
            comments: { lineComment: '#' },
            brackets: [['{', '}'], ['[', ']'], ['(', ')']],
            autoClosingPairs: [
                { open: '"', close: '"' },
                { open: "'", close: "'" },
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
            ],
        });
        monacoApi.languages.setMonarchTokensProvider('fivem-cfg', {
            ignoreCase: true,
            tokenizer: {
                root: [
                    [/#.*$/, 'comment'],
                    [/\/\/.*$/, 'comment'],
                    [/"([^"\\]|\\.)*"/, 'string'],
                    [/'([^'\\]|\\.)*'/, 'string'],
                    [/\b(?:start|stop|ensure|restart|refresh|exec|quit|set|seta|setr|sets)\b/, 'keyword.control'],
                    [/\b(?:endpoint_add_tcp|endpoint_add_udp|load_server_icon|sv_authMaxVariance|sv_authMinTrust|sv_endpointPrivacy|sv_hostname|sv_licenseKey|sv_master1|sv_maxClients|rcon_password|sv_scriptHookAllowed|gamename|onesync|sv_enforceGameBuild)\b/, 'keyword'],
                    [/\b(?:add_ace|add_principal|remove_ace|remove_principal|test_ace)\b/, 'type.identifier'],
                    [/\b(?:banner_connecting|banner_detail|locale|steam_webApiKey|tags|mysql_connection_string|sv_projectName|sv_projectDesc)\b/, 'variable.predefined'],
                    [/0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i, 'number'],
                    [/[a-z_$][\w$]*/, 'identifier'],
                ],
            },
        });
    }
    monacoApi.editor.defineTheme('cadmin-cfg', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '71717a' },
            { token: 'keyword.control', foreground: 'c084fc' },
            { token: 'keyword', foreground: '60a5fa' },
            { token: 'type.identifier', foreground: 'fbbf24' },
            { token: 'variable.predefined', foreground: '22d3ee' },
            { token: 'string', foreground: '86efac' },
        ],
        colors: editorThemeColors,
    });
};

export default function CfgEditorPage() {
    const fetcher = useAuthedFetcher();
    const openConfirmDialog = useOpenConfirmDialog();
    const [contents, setContents] = useState('');
    const [savedContents, setSavedContents] = useState('');
    const [fileName, setFileName] = useState('server.cfg');
    const [initialized, setInitialized] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const saveRef = useRef<() => void>(() => undefined);

    const cfgSWR = useSWR('/cfgEditor/data', async (url) => {
        const response = await fetcher<CfgDataResponse>(url);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }, { revalidateOnFocus: false });

    useEffect(() => {
        if (!cfgSWR.data || initialized) return;
        setContents(cfgSWR.data.contents);
        setSavedContents(cfgSWR.data.contents);
        setFileName(cfgSWR.data.fileName);
        setInitialized(true);
    }, [cfgSWR.data, initialized]);

    const isDirty = initialized && contents !== savedContents;
    useEffect(() => {
        if (!isDirty) return;
        const warnBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warnBeforeUnload);
        return () => window.removeEventListener('beforeunload', warnBeforeUnload);
    }, [isDirty]);

    const persistChanges = async () => {
        if (!isDirty || isSaving) return;
        setIsSaving(true);
        const toastId = txToast.loading(t('Saving {file}…', { file: fileName }));
        try {
            const response = await fetcher<SaveResponse>('/cfgEditor/save', {
                method: 'POST',
                body: { cfgData: contents },
            });
            const details = t(response.details || response.message || 'Unknown error.');
            if (response.type === 'danger') {
                const title = response.code === 'validation_errors' ? t('CFG validation failed')
                    : response.code === 'permission_denied' ? t('Permission denied')
                    : response.code === 'not_configured' ? t('Server path not configured')
                    : t('CFG could not be saved');
                txToast.error({ title, msg: details, md: Boolean(response.markdown || response.details) }, { id: toastId });
                return;
            }
            setSavedContents(contents);
            if (response.type === 'warning') {
                txToast.warning({ title: t('CFG saved with warnings'), msg: details, md: Boolean(response.markdown || response.details) }, { id: toastId });
            } else {
                txToast.success(t('CFG saved.'), { id: toastId });
            }
        } catch (error) {
            txToast.error({
                title: t('CFG could not be saved'),
                msg: t(error instanceof Error ? error.message : 'Unknown error.'),
            }, { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const requestSave = () => {
        if (!isDirty || isSaving) return;
        if (contents.length >= 1_024) {
            void persistChanges();
            return;
        }
        openConfirmDialog({
            title: t('Save a very small CFG file?'),
            message: t('This file is unusually small. Saving it may remove required server settings. A backup will still be created.'),
            cancelLabel: t('Cancel'),
            actionLabel: t('Save anyway'),
            confirmBtnVariant: 'warning',
            onConfirm: () => void persistChanges(),
        });
    };
    saveRef.current = requestSave;

    const handleEditorMount: OnMount = (editor, monacoApi) => {
        editor.addCommand(monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyS, () => saveRef.current());
        editor.addCommand(monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.Semicolon, () => {
            void editor.getAction('editor.action.commentLine')?.run();
        });
    };

    const lineCount = contents ? contents.split(/\r?\n/).length : 1;
    const loadError = cfgSWR.error?.message as keyof typeof loadErrors | undefined;

    return <div className="flex min-h-0 flex-col pb-6">
        <PageHeader title={t('CFG Editor')} icon={<FileCode2 className="size-6" />}>
            <div className="flex items-center gap-2">
                <Button variant="outline" disabled={!isDirty || isSaving} onClick={() => setContents(savedContents)}>
                    <RotateCcw className="mr-2 size-4" />{t('Discard')}
                </Button>
                <Button disabled={!isDirty || isSaving} onClick={requestSave}>
                    {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{t('Save changes')}
                </Button>
            </div>
        </PageHeader>

        {cfgSWR.isLoading && !initialized && <Card><CardContent className="flex items-center justify-center gap-2 p-14 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />{t('Loading CFG file…')}</CardContent></Card>}
        {cfgSWR.error && <Card className="border-red-500/20 bg-red-500/10"><CardContent className="flex items-start gap-3 p-5 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />{t(loadError ? loadErrors[loadError] : 'The CFG file could not be loaded.')}
        </CardContent></Card>}

        {initialized && <Card className="min-h-0 overflow-hidden border-white/10 bg-[#0b0d11]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[#111318] px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="truncate font-mono text-sm text-zinc-200">{fileName}</span>
                    <Badge variant="outline" className={isDirty ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}>
                        {isDirty ? t('Unsaved') : t('Saved')}
                    </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-600">
                    <span>{t('{count} lines', { count: lineCount })}</span>
                    <span>{t('{count} characters', { count: contents.length })}</span>
                </div>
            </div>
            <div className="h-[calc(100vh-19rem)] min-h-[26rem]">
                <Editor
                    beforeMount={configureMonaco}
                    onMount={handleEditorMount}
                    language="fivem-cfg"
                    theme="cadmin-cfg"
                    value={contents}
                    onChange={value => setContents(value ?? '')}
                    loading={<div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />{t('Starting editor…')}</div>}
                    options={{
                        automaticLayout: true,
                        contextmenu: true,
                        cursorBlinking: 'smooth',
                        fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", Consolas, monospace',
                        fontLigatures: true,
                        fontSize: 13,
                        lineHeight: 18,
                        lineNumbers: 'on',
                        minimap: { enabled: false },
                        padding: { top: 10, bottom: 10 },
                        renderWhitespace: 'selection',
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        tabSize: 4,
                        wordWrap: 'on',
                    }}
                />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 bg-[#111318] px-4 py-2 text-[11px] text-zinc-600">
                <span>{t('A backup is created before every successful save.')}</span>
                <span>{t('Ctrl+S save · Ctrl+; toggle comment')}</span>
            </div>
        </Card>}
    </div>;
}
