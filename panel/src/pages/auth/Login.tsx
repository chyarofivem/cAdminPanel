import { useEffect, useState } from 'react';
import PanelBrand from '@/components/PanelBrand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
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

const feedbackVariants = {
    info: 'default',
    success: 'success',
    error: 'destructive',
} as const;

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

    const field = 'flex flex-col gap-2';
    const helper = 'text-dense text-muted-foreground';
    return <main className="p-4 sm:p-6">
        <header className="flex items-center gap-3">
            <PanelBrand useLogo className="size-10 shrink-0" />
            <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">{window.txConsts.panelName}</p>
                {serverName && serverName !== window.txConsts.panelName && <p className="truncate text-dense text-muted-foreground">{serverName}</p>}
            </div>
        </header>

        <section className="mt-6">
            <h1 className="text-xl font-semibold text-white">{needsBootstrap ? t('Create the master account') : t('Sign in')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{needsBootstrap
                ? t('Enter the one-time PIN shown in the server console, then pick the username and password of the master account.')
                : t('Sign in with your panel username and password.')}</p>

            {feedback && <Alert variant={feedbackVariants[feedback.tone]} aria-live="polite" className="mt-6 whitespace-pre-wrap">
                {feedback.text}
            </Alert>}

            {needsBootstrap ? <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void createMasterAccount(); }}>
                <div className={field}>
                    <Label htmlFor="bootstrap-pin">{t('One-time bootstrap PIN')}</Label>
                    <Input id="bootstrap-pin" value={bootstrapPin} required autoComplete="one-time-code" className="font-mono" disabled={isFetching} onChange={event => setBootstrapPin(event.target.value)} />
                    <p className={helper}>{t('The PIN is printed in the server console and changes every time the panel restarts.')}</p>
                </div>
                <div className={field}>
                    <Label htmlFor="master-username">{t('Username')}</Label>
                    <Input id="master-username" value={username} required autoCapitalize="off" autoComplete="username" disabled={isFetching} onChange={event => setUsername(event.target.value)} />
                </div>
                <div className={field}>
                    <Label htmlFor="master-password">{t('Password')}</Label>
                    <Input id="master-password" type="password" value={password} required autoComplete="new-password" disabled={isFetching} onChange={event => setPassword(event.target.value)} />
                </div>
                <div className={field}>
                    <Label htmlFor="master-password-confirmation">{t('Repeat password')}</Label>
                    <Input id="master-password-confirmation" type="password" value={passwordConfirmation} required autoComplete="new-password" disabled={isFetching} onChange={event => setPasswordConfirmation(event.target.value)} />
                </div>
                <div className="pt-2">
                    <Button type="submit" className="w-full sm:w-auto" disabled={isFetching}>
                        {isFetching ? t('Creating…') : t('Create & Sign In')}
                    </Button>
                </div>
            </form> : <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void passwordLogin(); }}>
                <div className={field}>
                    <Label htmlFor="local-username">{t('Username')}</Label>
                    <Input id="local-username" value={username} required autoCapitalize="off" autoComplete="username" disabled={isFetching} onChange={event => setUsername(event.target.value)} />
                </div>
                <div className={field}>
                    <Label htmlFor="local-password">{t('Password')}</Label>
                    <Input id="local-password" type="password" value={password} required autoComplete="current-password" disabled={isFetching} onChange={event => setPassword(event.target.value)} />
                </div>
                <div className="pt-2">
                    <Button type="submit" className="w-full sm:w-auto" disabled={isFetching}>
                        {isFetching ? t('Signing in…') : t('Sign in')}
                    </Button>
                </div>
            </form>}

            <p className="mt-6 text-dense text-muted-foreground">
                {t("This server's local administrator list controls who can sign in.")}
            </p>
        </section>
    </main>;
}
