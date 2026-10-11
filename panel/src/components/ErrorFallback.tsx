import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card"
import { FallbackProps } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect } from "react";
import { LocalStorageKey } from "@/lib/localStorage";
import { t } from '@/lib/i18n';
import { reloadPanel } from '@/lib/navigation';

/**
 * React's DOM got out of sync with the page, which in development is almost always a hot
 * reload leaving stale nodes behind. Each browser words it differently:
 * - Chrome: "Failed to execute 'removeChild' on 'Node'"
 * - Firefox: "Node.removeChild: The node to be removed is not a child of this node"
 * - Safari: a NotFoundError, "The object can not be found here."
 * The insertBefore variants come from the same cause.
 */
export const isDomDesyncError = (error: unknown) => {
    if (!(error instanceof Error)) return false;
    if (error.name === 'NotFoundError') return true;
    return /\b(removeChild|insertBefore)\b/.test(error.message ?? '');
};

//Used for global errors
export function AppErrorFallback({ error }: FallbackProps) {
    const refreshPage = () => {
        reloadPanel();
    }
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center p-4">
            <GenericErrorBoundaryCard
                title={t('App Error:')}
                description={t('Due to an unexpected error, the panel has crashed.')}
                error={error}
                resetButton={<Button onClick={refreshPage}>{t('Refresh')}</Button>}
            />
        </div>
    );
}

//Used for page errors (inside the shell)
export function PageErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="flex w-full flex-col items-center justify-center pt-6">
            <GenericErrorBoundaryCard
                title={t('Page Error:')}
                description={t('There was an error rendering this page.')}
                error={error}
                resetButton={<Button onClick={resetErrorBoundary}>{t('Go Back')}</Button>}
            />
        </div>
    );
}


type GenericErrorBoundaryCardProps = {
    title: string;
    description: string;
    error: Error;
    resetButton: React.ReactNode;
}

export function GenericErrorBoundaryCard(props: GenericErrorBoundaryCardProps) {
    //Auto refresh the page if the error is related to removeChild - dev mode only
    if (window.txConsts.showAdvanced) {
        useEffect(() => {
            if (isDomDesyncError(props.error)) {
                console.warn('Detected removeChild error, scheduling reload');
                // Use a flag in sessionStorage to prevent infinite reload loops
                const lastReloadRaw = localStorage.getItem(LocalStorageKey.ErrorFallbackLastReload);
                const now = Date.now();
                const lastReload = lastReloadRaw ? parseInt(lastReloadRaw) : 0;
                if (now - lastReload > 30_000) {
                    localStorage.setItem(LocalStorageKey.ErrorFallbackLastReload, now.toString());
                    setTimeout(reloadPanel, 500);
                }
            }
        }, [props.error]);
    }

    return (
        <Card className="w-full max-w-xl">
            <CardHeader>
                <h1 className="text-xl font-semibold leading-tight text-white">{props.title}</h1>
                <p className="text-sm text-muted-foreground">{props.description}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-body">
                <p className="truncate">
                    {t('Page')}:&nbsp;
                    <code className="font-mono text-dense text-white">
                        {window.location.pathname ?? 'unknown'}
                        {window.location.search ?? ''}
                    </code>
                </p>
                <p>
                    {t('Versions')}:&nbsp;
                    <code className="font-mono text-dense text-white">
                        cAdminPanel v{window.txConsts.txaVersion} atop FXServer b{window.txConsts.fxsVersion}
                    </code>
                </p>
                <p>
                    {t('Message')}:&nbsp;
                    <code className="font-mono text-dense text-danger-text">{props.error.message ?? 'unknown'}</code>
                </p>
                <p>{t('Stack')}:</p>
                <pre>
                    <ScrollArea
                        className="h-32 w-full rounded-lg bg-sunken p-3 font-mono text-xs text-muted-foreground"
                    >{props.error.stack}</ScrollArea>
                </pre>
            </CardContent>
            <CardFooter>
                {props.resetButton}
            </CardFooter>
        </Card>
    );
}
