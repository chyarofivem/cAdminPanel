import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Fingerprint, Loader2, LogIn, PlugZap } from 'lucide-react';
import PanelBrand from '@/components/PanelBrand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchWithTimeout } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import { isValidRedirectPath, LogoutReasonHash, navigatePanel } from '@/lib/navigation';
import { useAuth } from '@/hooks/auth';
import type { ApiVerifyPasswordReq, ApiVerifyPasswordResp } from '@shared/authApiTypes';

type SetupResponse = {
    success: boolean;
    message?: string;
    identities?: string[];
    saved?: boolean;
    authorized?: boolean;
};

type SetupRequest = {
    action: 'test' | 'save';
    apiUrl: string;
    apiKey: string;
    panelUrl: string;
    bootstrapPin: string;
} | {
    action: 'authorize';
    bootstrapPin: string;
};

type Feedback = {
    text: string;
    tone: 'info' | 'success' | 'error';
};

const feedbackStyles: Record<Feedback['tone'], string> = {
    info: 'border-white/10 bg-white/[0.035] text-zinc-300',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    error: 'border-red-500/20 bg-red-500/10 text-red-300',
};

export default function Login() {
    const { setAuthData } = useAuth();
    const [apiUrl, setApiUrl] = useState(window.txConsts.chyaroUrl);
    const [apiKey, setApiKey] = useState('');
    const [panelUrl, setPanelUrl] = useState(() => window.location.protocol === 'https:' ? window.location.origin : 'https://');
    const [bootstrapPin, setBootstrapPin] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [connectionOk, setConnectionOk] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [feedback, setFeedback] = useState<Feedback>();
    const [redirectPath] = useState(() => {
        const candidate = new URLSearchParams(window.location.search).get('r');
        return isValidRedirectPath(candidate) ? candidate : undefined;
    });
    const needsBootstrap = !window.txConsts.hasMasterAccount;
    const needsProviderSetup = needsBootstrap && !window.txConsts.chyaroConfigured;
    const serverName = window.txConsts.server?.name;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const authError = params.get('authError');
        if (authError) setFeedback({ text: t(authError), tone: 'error' });

        const hashMessages: Record<string, string> = {
            [LogoutReasonHash.LOGOUT]: t('Logged out.'),
            [LogoutReasonHash.EXPIRED]: t('Your session expired. Please sign in again.'),
            [LogoutReasonHash.UPDATED]: t('The panel was updated. Please sign in again.'),
            [LogoutReasonHash.MASTER_ALREADY_SET]: t('The master account is already configured.'),
            [LogoutReasonHash.SHUTDOWN]: t('The panel shut down. Start it again before signing in.'),
        };
        if (hashMessages[window.location.hash]) {
            setFeedback({ text: hashMessages[window.location.hash], tone: 'info' });
        }
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }, []);

    const updateConnectionField = (setter: (value: string) => void, value: string) => {
        setter(value);
        setConnectionOk(false);
        setFeedback(current => current?.tone === 'success' ? undefined : current);
    };

    const startLogin = () => {
        const suffix = redirectPath ? `?r=${encodeURIComponent(redirectPath)}` : '';
        navigatePanel(`/auth/chyaro/login${suffix}`);
    };

    const passwordLogin = async () => {
        setIsFetching(true);
        setFeedback(undefined);
        try {
            const data = await fetchWithTimeout<ApiVerifyPasswordResp, ApiVerifyPasswordReq>(
                `/auth/password?uiVersion=${encodeURIComponent(window.txConsts.txaVersion)}`,
                { method: 'POST', body: { username, password } },
            );
            if ('error' in data) {
                if (data.error === 'refreshToUpdate') {
                    navigatePanel(`/login${LogoutReasonHash.UPDATED}`);
                    return;
                }
                throw new Error(data.error === 'no_admins_setup'
                    ? t('No administrators are configured yet.')
                    : data.error);
            }
            setAuthData(data);
            navigatePanel(redirectPath ?? '/');
        } catch (error) {
            setFeedback({
                tone: 'error',
                text: t(error instanceof Error ? error.message : 'Sign-in failed.'),
            });
        } finally {
            setIsFetching(false);
        }
    };

    const runSetup = async (action: 'test' | 'save' | 'authorize') => {
        setIsFetching(true);
        setFeedback(undefined);
        try {
            const body: SetupRequest = action === 'authorize'
                ? { action, bootstrapPin }
                : { action, apiUrl, apiKey, panelUrl, bootstrapPin };
            const data = await fetchWithTimeout<SetupResponse, SetupRequest>(
                '/auth/chyaro/setup',
                { method: 'POST', body },
            );
            if (!data.success) throw new Error(data.message || t('Connection failed.'));
            setConnectionOk(true);
            if (data.saved || data.authorized) {
                startLogin();
                return;
            }
            setFeedback({
                tone: 'success',
                text: `${t('Connection successful.')} ${data.identities?.length
                    ? t('Verified identities found: {identities}.', { identities: data.identities.join(', ') })
                    : t('No identities were returned yet.')}`,
            });
        } catch (error) {
            setConnectionOk(false);
            setFeedback({
                tone: 'error',
                text: t(error instanceof Error ? error.message : 'Connection failed.'),
            });
        } finally {
            setIsFetching(false);
        }
    };

    return <main className="p-6 sm:p-8">
        <header className="flex items-center gap-4 border-b border-white/5 pb-5">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 p-2">
                <PanelBrand useLogo className="max-h-10 max-w-10" />
            </div>
            <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-white">{window.txConsts.panelName}</p>
                {serverName && serverName !== window.txConsts.panelName && <p className="mt-0.5 truncate text-xs text-zinc-500">{serverName}</p>}
            </div>
        </header>

        <section className="pt-6">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{needsProviderSetup ? t('Connect chyarologin') : needsBootstrap ? t('Authorize first sign-in') : t('Sign in')}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{needsBootstrap
                ? t('Enter the one-time PIN shown in the txAdmin console to create the first master account.')
                : t('Use your local credentials or continue with chyarologin.')}</p>

            {feedback && <div aria-live="polite" className={`mt-5 flex items-start gap-3 rounded-xl border p-3 text-sm ${feedbackStyles[feedback.tone]}`}>
                {feedback.tone === 'success'
                    ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
                <span className="whitespace-pre-wrap">{feedback.text}</span>
            </div>}

            {needsBootstrap ? <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void runSetup(needsProviderSetup ? 'test' : 'authorize'); }}>
                <div className="space-y-2 text-left">
                    <Label htmlFor="bootstrap-pin">{t('One-time bootstrap PIN')}</Label>
                    <Input id="bootstrap-pin" value={bootstrapPin} required autoComplete="one-time-code" onChange={event => updateConnectionField(setBootstrapPin, event.target.value)} />
                    <p className="text-xs text-zinc-500">{t('The PIN is printed in the txAdmin server console and expires when txAdmin restarts.')}</p>
                </div>
                {needsProviderSetup && <div className="space-y-2 text-left">
                    <Label htmlFor="chyaro-url">{t('chyarologin URL')}</Label>
                    <Input id="chyaro-url" type="url" value={apiUrl} required autoComplete="url" onChange={event => updateConnectionField(setApiUrl, event.target.value)} />
                </div>}
                {needsProviderSetup && <div className="space-y-2 text-left">
                    <Label htmlFor="chyaro-key">{t('API key')}</Label>
                    <Input id="chyaro-key" type="password" value={apiKey} required autoComplete="off" onChange={event => updateConnectionField(setApiKey, event.target.value)} />
                </div>}
                {needsProviderSetup && <div className="space-y-2 text-left">
                    <Label htmlFor="panel-url">{t('Public panel URL')}</Label>
                    <Input id="panel-url" type="url" inputMode="url" placeholder="https://panel.example.com" value={panelUrl} required pattern="https://.*" autoComplete="url" onChange={event => updateConnectionField(setPanelUrl, event.target.value)} />
                    <p className="text-xs text-zinc-500">{t('This HTTPS address is used for secure chyarologin callbacks.')}</p>
                </div>}
                {needsProviderSetup ? <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                    <Button type="submit" variant="outline" disabled={isFetching}>
                        {isFetching ? <Loader2 className="mr-2 size-4 animate-spin" /> : <PlugZap className="mr-2 size-4" />}{t('Test connection')}
                    </Button>
                    <Button type="button" disabled={!connectionOk || isFetching} onClick={() => void runSetup('save')}>
                        <CheckCircle2 className="mr-2 size-4" />{t('Save & Sign In')}
                    </Button>
                </div> : <Button type="submit" className="h-11 w-full justify-between" disabled={isFetching}>
                    <span className="flex items-center gap-2">{isFetching ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}{t('Authorize & Sign In')}</span>
                    <ArrowRight className="size-4" />
                </Button>}
            </form> : <div className="mt-6 space-y-4">
                <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void passwordLogin(); }}>
                    <div className="space-y-2 text-left">
                        <Label htmlFor="local-username">{t('Username')}</Label>
                        <Input id="local-username" value={username} required autoCapitalize="off" autoComplete="username" disabled={isFetching} onChange={event => setUsername(event.target.value)} />
                    </div>
                    <div className="space-y-2 text-left">
                        <Label htmlFor="local-password">{t('Password')}</Label>
                        <Input id="local-password" type="password" value={password} required autoComplete="current-password" disabled={isFetching} onChange={event => setPassword(event.target.value)} />
                    </div>
                    <Button type="submit" className="h-11 w-full justify-between" disabled={isFetching}>
                        <span className="flex items-center gap-2">{isFetching ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}{t('Sign in')}</span>
                        <ArrowRight className="size-4" />
                    </Button>
                </form>

                {window.txConsts.chyaroConfigured && <>
                    <div className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-white/5" /><span className="text-[10px] uppercase tracking-widest text-zinc-600">{t('or')}</span><span className="h-px flex-1 bg-white/5" /></div>
                    <Button type="button" variant="outline" className="h-11 w-full justify-between" disabled={isFetching} onClick={startLogin}>
                        <span className="flex items-center gap-2"><Fingerprint className="size-4" />{t('Continue with chyarologin')}</span>
                        <ArrowRight className="size-4" />
                    </Button>
                </>}
                {!window.txConsts.chyaroConfigured && <p className="text-center text-xs leading-5 text-zinc-600">{t('chyarologin is not configured; local sign-in remains available.')}</p>}
            </div>}

            <p className="mt-6 border-t border-white/5 pt-4 text-xs leading-5 text-zinc-500">
                {t("This server's local administrator list controls access for both sign-in methods.")}
            </p>
        </section>
    </main>;
}
