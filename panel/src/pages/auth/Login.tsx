import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import PanelBrand from '@/components/PanelBrand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchWithTimeout } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import { isValidRedirectPath, LogoutReasonHash, navigatePanel } from '@/lib/navigation';
import { useAuth } from '@/hooks/auth';
import type {
    ApiVerifyPasswordReq,
    ApiVerifyPasswordResp,
    ReactAuthDataType,
} from '@shared/authApiTypes';

type BootstrapRequest = {
    pin: string;
    username: string;
    password: string;
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
    const [bootstrapPin, setBootstrapPin] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [feedback, setFeedback] = useState<Feedback>();
    const [redirectPath] = useState(() => {
        const candidate = new URLSearchParams(window.location.search).get('r');
        return isValidRedirectPath(candidate) ? candidate : undefined;
    });
    const needsBootstrap = !window.txConsts.hasMasterAccount;
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

    const finishSignIn = (data: ReactAuthDataType) => {
        setAuthData(data);
        navigatePanel(redirectPath ?? '/');
    };

    const handleError = (error: unknown, fallback: string) => {
        setFeedback({
            tone: 'error',
            text: t(error instanceof Error ? error.message : fallback),
        });
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
            finishSignIn(data);
        } catch (error) {
            handleError(error, 'Sign-in failed.');
        } finally {
            setIsFetching(false);
        }
    };

    const createMasterAccount = async () => {
        if (password !== passwordConfirmation) {
            setFeedback({ tone: 'error', text: t('The two passwords do not match.') });
            return;
        }
        setIsFetching(true);
        setFeedback(undefined);
        try {
            const data = await fetchWithTimeout<ApiVerifyPasswordResp, BootstrapRequest>(
                `/auth/bootstrap?uiVersion=${encodeURIComponent(window.txConsts.txaVersion)}`,
                { method: 'POST', body: { pin: bootstrapPin, username, password } },
            );
            if ('error' in data) {
                if (data.error === 'refreshToUpdate') {
                    navigatePanel(`/login${LogoutReasonHash.UPDATED}`);
                    return;
                }
                throw new Error(data.error);
            }
            finishSignIn(data);
        } catch (error) {
            handleError(error, 'Could not create the master account.');
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
            <h1 className="text-2xl font-semibold tracking-tight text-white">{needsBootstrap ? t('Create the master account') : t('Sign in')}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{needsBootstrap
                ? t('Enter the one-time PIN shown in the server console, then pick the username and password of the master account.')
                : t('Sign in with your panel username and password.')}</p>

            {feedback && <div aria-live="polite" className={`mt-5 flex items-start gap-3 rounded-xl border p-3 text-sm ${feedbackStyles[feedback.tone]}`}>
                {feedback.tone === 'success'
                    ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
                <span className="whitespace-pre-wrap">{feedback.text}</span>
            </div>}

            {needsBootstrap ? <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void createMasterAccount(); }}>
                <div className="space-y-2 text-left">
                    <Label htmlFor="bootstrap-pin">{t('One-time bootstrap PIN')}</Label>
                    <Input id="bootstrap-pin" value={bootstrapPin} required autoComplete="one-time-code" disabled={isFetching} onChange={event => setBootstrapPin(event.target.value)} />
                    <p className="text-xs text-zinc-500">{t('The PIN is printed in the server console and changes every time the panel restarts.')}</p>
                </div>
                <div className="space-y-2 text-left">
                    <Label htmlFor="master-username">{t('Username')}</Label>
                    <Input id="master-username" value={username} required autoCapitalize="off" autoComplete="username" disabled={isFetching} onChange={event => setUsername(event.target.value)} />
                </div>
                <div className="space-y-2 text-left">
                    <Label htmlFor="master-password">{t('Password')}</Label>
                    <Input id="master-password" type="password" value={password} required autoComplete="new-password" disabled={isFetching} onChange={event => setPassword(event.target.value)} />
                </div>
                <div className="space-y-2 text-left">
                    <Label htmlFor="master-password-confirmation">{t('Repeat password')}</Label>
                    <Input id="master-password-confirmation" type="password" value={passwordConfirmation} required autoComplete="new-password" disabled={isFetching} onChange={event => setPasswordConfirmation(event.target.value)} />
                </div>
                <Button type="submit" className="h-11 w-full justify-between" disabled={isFetching}>
                    <span className="flex items-center gap-2">{isFetching ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{t('Create & Sign In')}</span>
                    <ArrowRight className="size-4" />
                </Button>
            </form> : <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void passwordLogin(); }}>
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
            </form>}

            <p className="mt-6 border-t border-white/5 pt-4 text-xs leading-5 text-zinc-500">
                {t("This server's local administrator list controls who can sign in.")}
            </p>
        </section>
    </main>;
}
