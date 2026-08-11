import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card"
import { FallbackProps } from "react-error-boundary";
import { FiAlertOctagon } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect } from "react";
import { LocalStorageKey } from "@/lib/localStorage";
import { t } from '@/lib/i18n';
import { reloadPanel } from '@/lib/navigation';

//Used for global errors
export function AppErrorFallback({ error }: FallbackProps) {
    const refreshPage = () => {
        reloadPanel();
    }
    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-destructive/5 p-4">
            <GenericErrorBoundaryCard
                title={t('App Error:')}
                description={t('Due to an unexpected error, the panel has crashed.')}
                error={error}
                resetButton={<Button variant="outline" onClick={refreshPage}>{t('Refresh')}</Button>}
            />
        </div>
    );
}

//Used for page errors (inside the shell)
export function PageErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="w-full flex flex-col items-center justify-center">
            <GenericErrorBoundaryCard
                title={t('Page Error:')}
                description={t('There was an error rendering this page.')}
                error={error}
                resetButton={<Button variant="outline" onClick={resetErrorBoundary}>{t('Go Back')}</Button>}
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
            if (props.error.message?.includes("Failed to execute 'removeChild' on 'Node'")) {
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
        <Card className="w-full max-w-xl overflow-hidden border-destructive/20 bg-background/95 shadow-2xl">
            <CardHeader>
                <h1 className="text-2xl font-semibold text-destructive pb-0 flex flex-row justify-start items-center">
                    <span className="mr-3 rounded-xl bg-destructive/10 p-2"><FiAlertOctagon /></span>
                    {props.title}
                </h1>
                <span className="text-sm text-muted-foreground pt-0">{props.description}</span>
            </CardHeader>
            <CardContent>
                <p className="truncate">
                    {t('Page')}:&nbsp;
                    <code className="text-muted-foreground ">
                        {window.location.pathname ?? 'unknown'}
                        {window.location.search ?? ''}
                    </code>
                </p>
                <p>
                    {t('Versions')}:&nbsp;
                    <code className="text-muted-foreground">
                        cAdminPanel v{window.txConsts.txaVersion} atop FXServer b{window.txConsts.fxsVersion}
                    </code>
                </p>
                <p>
                    {t('Message')}:&nbsp;
                    <code className="text-muted-foreground">{props.error.message ?? 'unknown'}</code>
                </p>
                <p>{t('Stack')}:</p>
                <pre className="mt-1">
                    <ScrollArea
                        className="p-3 border border-white/10 rounded-lg bg-black/20
                                font-mono text-muted-foreground text-xs
                                h-32 w-full"
                    >{props.error.stack}</ScrollArea>
                </pre>
            </CardContent>
            <CardFooter>
                {props.resetButton}
            </CardFooter>
        </Card>
    );
}
