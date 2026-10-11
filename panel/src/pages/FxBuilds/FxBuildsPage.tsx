import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { RefreshCwIcon } from 'lucide-react';
import type {
    FxBuildChannel,
    FxBuildListItem,
    FxBuildsActionResp,
    FxBuildsData,
    FxBuildsDataResp,
    FxInstalledBuild,
} from '@shared/fxBuildTypes';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { txToast } from '@/components/TxToaster';
import { PageHeader } from '@/components/page-header';
import Section from '@/components/Section';
import { ListRow, ListRows } from '@/components/ListRow';
import UsageBar from '@/components/UsageBar';
import EmptyState from '@/components/EmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IconButton } from '@/components/ui/icon-button';
import { tsToLocaleDateString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';
import { channelBadgeVariant, formatBytePair, formatBytes, isDownloadRunning } from './fxBuildsUtils';

type ActionName = 'download' | 'cancel' | 'dismiss' | 'activate' | 'rollback' | 'delete';

const channelLabel = (channel: FxBuildChannel) => {
    if (channel === 'recommended') return t('Recommended');
    if (channel === 'latest') return t('Latest');
    if (channel === 'optional') return t('Optional');
    return t('Critical');
};

//Before the data arrives, the build number comes from the injected `12345/Win` style tag
const injectedHostBuild = Number.parseInt(window.txConsts.fxsVersion, 10) || null;


//MARK: Switch dialog body
type SwitchMessageProps = {
    build: number;
    hostBuild: number;
    isManaged: boolean;
    isOnline: boolean;
    fallbackBuild: number;
    onRestartChange: (restart: boolean) => void;
};

/**
 * Rendered inside the confirm dialog's description (a paragraph), so it only uses
 * phrasing elements: spans, a label and the checkbox button.
 */
function SwitchMessage({ build, hostBuild, isManaged, isOnline, fallbackBuild, onRestartChange }: SwitchMessageProps) {
    const [restartNow, setRestartNow] = useState(false);
    return <span className="flex flex-col gap-3">
        <span>
            {isOnline
                ? t('The game server switches to build {build} when it restarts. The panel stays on build {hostBuild}.', { build, hostBuild })
                : t('The game server starts on build {build} the next time it starts. The panel stays on build {hostBuild}.', { build, hostBuild })}
        </span>
        {isManaged && <span>
            {t('If it fails to start twice in a row, the server goes back to build {fallback} automatically.', { fallback: fallbackBuild })}
        </span>}
        {isOnline && <label className="flex min-h-11 cursor-pointer items-center gap-3 text-white">
            <Checkbox
                checked={restartNow}
                onCheckedChange={(checked) => {
                    const next = checked === true;
                    setRestartNow(next);
                    onRestartChange(next);
                }}
            />
            <span>{t('Restart the server now. Otherwise it switches on the next restart.')}</span>
        </label>}
    </span>;
}


//MARK: Status
function StatusItem({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="min-w-0">
        <dt className="text-dense text-muted-foreground">{label}</dt>
        <dd className="mt-1 flex min-h-9 flex-wrap items-center gap-2">{children}</dd>
    </div>;
}

type StatusSectionProps = {
    data: FxBuildsData;
    disabled: boolean;
    onRollback: () => void;
};

function StatusSection({ data, disabled, onRollback }: StatusSectionProps) {
    const targetBuild = data.activeBuild ?? data.hostBuild;
    const isOnline = data.runningBuild !== null;
    const isVerifying = data.pending !== null && data.runningBuild === data.pending.build;
    const shownBuild = data.runningBuild ?? targetBuild;
    const hasPrevious = data.previousBuild !== data.activeBuild;
    const previousNumber = data.previousBuild ?? data.hostBuild;

    let statusBadge: React.ReactNode;
    if (!isOnline) {
        statusBadge = <Badge>{t('Offline')}</Badge>;
    } else if (isVerifying) {
        statusBadge = <Badge variant="info">{t('Verifying')}</Badge>;
    } else {
        statusBadge = <Badge variant="success">{t('Running')}</Badge>;
    }

    return <Section title={t('Game server')}>
        <dl className="grid gap-4 sm:grid-cols-3">
            <StatusItem label={t('Game server build')}>
                <span className="text-lg font-semibold tabular-nums text-white">{shownBuild}</span>
                {statusBadge}
            </StatusItem>
            <StatusItem label={t('Panel build')}>
                <span className="text-lg font-semibold tabular-nums text-white">{data.hostBuild}</span>
            </StatusItem>
            <StatusItem label={t('Previous build')}>
                {hasPrevious ? <>
                    <span className="text-lg font-semibold tabular-nums text-white">{previousNumber}</span>
                    {data.previousBuild === null && <span className="text-dense text-muted-foreground">{t('Panel build')}</span>}
                    <Button size="sm" variant="secondary" disabled={disabled} onClick={onRollback}>
                        {t('Roll back')}
                    </Button>
                </> : <span className="text-sm text-muted-foreground">{t('None')}</span>}
            </StatusItem>
        </dl>

        {(isOnline && data.runningBuild !== targetBuild) || isVerifying ? <div className="mt-4 flex flex-col gap-1 text-dense text-muted-foreground">
            {isOnline && data.runningBuild !== targetBuild && <p>
                {data.activeBuild === null
                    ? t('Switches to the panel build {build} on the next restart.', { build: data.hostBuild })
                    : t('Switches to build {build} on the next restart.', { build: targetBuild })}
            </p>}
            {isVerifying && data.pending && <p>
                {t('Build {build} is being verified. If it fails to start twice in a row, the server goes back to build {previous}.', {
                    build: data.pending.build,
                    previous: previousNumber,
                })}
                {data.pending.failures > 0 && <>
                    {' '}
                    <span className="tabular-nums">{t('Failed starts so far: {count} of 2.', { count: data.pending.failures })}</span>
                </>}
            </p>}
        </div> : null}
    </Section>;
}


//MARK: Download progress
type DownloadSectionProps = {
    data: FxBuildsData;
    disabled: boolean;
    onCancel: () => void;
    onDismiss: () => void;
    onRetry: (build: number) => void;
};

function DownloadSection({ data, disabled, onCancel, onDismiss, onRetry }: DownloadSectionProps) {
    const download = data.download;
    if (!download) return null;

    if (download.phase === 'error') {
        return <Alert variant="destructive">
            <AlertTitle>{t('Build {build} could not be downloaded', { build: download.build })}</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
                <span className="break-words">{download.error ?? t('The download failed.')}</span>
                <span className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onRetry(download.build)}>
                        {t('Try again')}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={disabled} onClick={onDismiss}>
                        {t('Dismiss')}
                    </Button>
                </span>
            </AlertDescription>
        </Alert>;
    }
    if (!isDownloadRunning(download)) return null;

    //Extracting and finishing report no progress of their own, so they show which step is running
    const isDownloading = download.phase === 'downloading';
    const bar = isDownloading
        ? {
            label: t('Downloading'),
            valueLabel: formatBytePair(download.receivedBytes, download.totalBytes),
            percent: download.totalBytes ? (download.receivedBytes / download.totalBytes) * 100 : 0,
        }
        : {
            label: download.phase === 'extracting' ? t('Extracting files') : t('Finishing'),
            valueLabel: t('Step {step} of 3', { step: download.phase === 'extracting' ? 2 : 3 }),
            percent: 0,
        };

    return <Section
        title={isDownloading
            ? t('Downloading build {build}', { build: download.build })
            : t('Installing build {build}', { build: download.build })}
        actions={<Button size="sm" variant="secondary" disabled={disabled} onClick={onCancel}>
            {isDownloading ? t('Cancel download') : t('Cancel')}
        </Button>}
    >
        <UsageBar
            kind="progress"
            indeterminate={!isDownloading || !download.totalBytes}
            label={bar.label}
            valueLabel={bar.valueLabel}
            percent={bar.percent}
        />
    </Section>;
}


//MARK: Build rows
type CatalogRowProps = {
    item: FxBuildListItem;
    data: FxBuildsData;
    disabled: boolean;
    onUse: (build: number | null) => void;
    onDownload: (build: number) => void;
};

function CatalogRow({ item, data, disabled, onUse, onDownload }: CatalogRowProps) {
    const inUse = item.isActive || (item.isHost && data.activeBuild === null);
    const isDownloadingThis = isDownloadRunning(data.download) && data.download?.build === item.build;

    let action: React.ReactNode = null;
    if (inUse) {
        action = null;
    } else if (item.isHost || item.installed) {
        action = <Button
            size="sm"
            variant="secondary"
            disabled={disabled}
            aria-label={t('Use build {build}', { build: item.build })}
            onClick={() => onUse(item.isHost && !item.installed ? null : item.build)}
        >
            {t('Use')}
        </Button>;
    } else if (isDownloadingThis) {
        action = <Badge variant="info">{t('Downloading')}</Badge>;
    } else if (item.downloadable) {
        action = <Button
            size="sm"
            variant="secondary"
            disabled={disabled || isDownloadRunning(data.download)}
            aria-label={t('Download build {build}', { build: item.build })}
            onClick={() => onDownload(item.build)}
        >
            {t('Download')}
        </Button>;
    } else {
        action = <span className="text-dense text-muted-foreground">{t('Not available')}</span>;
    }

    return <ListRow className="flex-col items-stretch sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-sm font-medium tabular-nums text-white">{item.build}</span>
            {item.tags.map((tag) => <Badge key={tag} variant={channelBadgeVariant(tag)}>{channelLabel(tag)}</Badge>)}
            {item.isHost && <Badge>{t('Panel build')}</Badge>}
            {inUse && <Badge variant="success">{t('In use')}</Badge>}
            {item.installed && !inUse && <Badge>{t('Downloaded')}</Badge>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </ListRow>;
}

type InstalledRowProps = {
    item: FxInstalledBuild;
    disabled: boolean;
    onUse: (build: number) => void;
    onDelete: (item: FxInstalledBuild) => void;
};

function InstalledRow({ item, disabled, onUse, onDelete }: InstalledRowProps) {
    const details = [
        item.sizeBytes > 0 ? formatBytes(item.sizeBytes) : null,
        item.monitorVersion ? t('Panel files {version}', { version: item.monitorVersion }) : null,
        item.installedAt > 0 ? t('Downloaded {date}', { date: tsToLocaleDateString(item.installedAt, 'medium') }) : null,
    ].filter(Boolean).join(' · ');

    return <ListRow className="flex-col items-stretch sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium tabular-nums text-white">{item.build}</span>
                {item.isActive && <Badge variant="success">{t('In use')}</Badge>}
                {item.isPrevious && <Badge>{t('Previous')}</Badge>}
                {!item.isAvailable && <Badge variant="danger">{t('Missing files')}</Badge>}
            </div>
            {details && <p className="mt-1 text-dense tabular-nums text-muted-foreground">{details}</p>}
        </div>
        {!item.isActive && <div className="flex shrink-0 flex-wrap items-center gap-2">
            {item.isAvailable && <Button
                size="sm"
                variant="secondary"
                disabled={disabled}
                aria-label={t('Use build {build}', { build: item.build })}
                onClick={() => onUse(item.build)}
            >
                {t('Use')}
            </Button>}
            <Button
                size="sm"
                variant="outline-destructive"
                disabled={disabled}
                aria-label={t('Delete build {build}', { build: item.build })}
                onClick={() => onDelete(item)}
            >
                {t('Delete')}
            </Button>
        </div>}
    </ListRow>;
}

function ListHeading({ title, description }: { title: string; description: string }) {
    return <div>
        <h2 className="text-base font-semibold leading-tight text-white">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>;
}


//MARK: Page
export default function FxBuildsPage() {
    const fetcher = useAuthedFetcher();
    const openConfirmDialog = useOpenConfirmDialog();
    const [busyAction, setBusyAction] = useState<ActionName | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const swr = useSWR('/fxBuilds/data', async (url: string) => {
        const resp = await fetcher<FxBuildsDataResp>(url);
        if (!resp.success) throw new Error(resp.error);
        return resp.data;
    }, {
        //Poll fast while downloading, a bit while a switched build is verified
        refreshInterval: (data) => {
            if (isDownloadRunning(data?.download)) return 1000;
            if (data?.pending) return 3000;
            return 15_000;
        },
    });
    const data = swr.data;

    //Announce a download that finished while the page was open
    const lastDownloadRef = useRef<{ build: number; phase: string } | null>(null);
    useEffect(() => {
        const download = data?.download ?? null;
        const last = lastDownloadRef.current;
        if (download && last && last.build === download.build && last.phase !== 'done' && download.phase === 'done') {
            txToast.success(t('Build {build} is downloaded and ready to use.', { build: download.build }));
        }
        lastDownloadRef.current = download ? { build: download.build, phase: download.phase } : null;
    }, [data?.download?.build, data?.download?.phase]);

    const postAction = async (action: ActionName, body: object, successMessage?: string) => {
        setBusyAction(action);
        try {
            const resp = await fetcher<FxBuildsActionResp>(`/fxBuilds/${action}`, { method: 'POST', body });
            if (!resp.success) throw new Error(resp.error);
            if (successMessage) txToast.success(successMessage);
        } catch (error) {
            txToast.error(error instanceof Error ? t(error.message) : t('The request failed.'));
        } finally {
            setBusyAction(null);
            void swr.mutate();
        }
    };

    const refreshLists = async () => {
        setIsRefreshing(true);
        try {
            const resp = await fetcher<FxBuildsDataResp>('/fxBuilds/data?refresh=1');
            if (!resp.success) throw new Error(resp.error);
            await swr.mutate(resp.data, { revalidate: false });
        } catch (error) {
            txToast.error(error instanceof Error ? t(error.message) : t('The request failed.'));
        } finally {
            setIsRefreshing(false);
        }
    };

    const switchSuccessMessage = (build: number, restart: boolean, isOnline: boolean) => {
        if (!isOnline) return t('The server starts on build {build} next time.', { build });
        if (restart) return t('Restarting the server on build {build}.', { build });
        return t('Build {build} is used from the next restart.', { build });
    };

    const confirmSwitch = (action: 'activate' | 'rollback', target: number | null) => {
        if (!data) return;
        const isOnline = data.runningBuild !== null;
        const build = target ?? data.hostBuild;
        const restartChoice = { current: false };
        openConfirmDialog({
            title: action === 'rollback'
                ? t('Roll back to build {build}?', { build })
                : t('Use build {build}?', { build }),
            message: <SwitchMessage
                build={build}
                hostBuild={data.hostBuild}
                isManaged={target !== null}
                isOnline={isOnline}
                fallbackBuild={data.activeBuild ?? data.hostBuild}
                onRestartChange={(restart) => { restartChoice.current = restart; }}
            />,
            actionLabel: action === 'rollback' ? t('Roll back') : t('Use build'),
            confirmBtnVariant: 'default',
            onConfirm: () => {
                const restart = restartChoice.current;
                const body = action === 'activate' ? { build: target, restart } : { restart };
                void postAction(action, body, switchSuccessMessage(build, restart, isOnline));
            },
        });
    };

    const confirmDelete = (item: FxInstalledBuild) => openConfirmDialog({
        title: t('Delete build {build}?', { build: item.build }),
        message: t('This removes its downloaded files. You can download it again later.'),
        actionLabel: t('Delete'),
        onConfirm: () => {
            void postAction('delete', { build: item.build }, t('Build {build} deleted.', { build: item.build }));
        },
    });

    const startDownload = (build: number) => {
        void postAction('download', { build }, t('Downloading build {build}.', { build }));
    };

    const hostBuild = data?.hostBuild ?? injectedHostBuild;
    const locked = !!data?.providerManaged;
    const disabled = locked || busyAction !== null;

    return <div className="pb-8">
        <PageHeader
            title={t('FXServer builds')}
            subtitle={hostBuild
                ? t('The game server can run a different build while the panel stays on build {build}.', { build: hostBuild })
                : undefined}
        >
            <IconButton
                label={t('Refresh build lists')}
                icon={<RefreshCwIcon />}
                className="size-11 sm:size-9"
                disabled={isRefreshing || swr.isLoading}
                onClick={() => void refreshLists()}
            />
        </PageHeader>

        <div className="flex flex-col gap-6">
            {swr.error && <Alert variant="destructive">
                <AlertTitle>{t('Could not load FXServer builds')}</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-3">
                    <span>{t(swr.error.message)}</span>
                    <Button size="sm" variant="secondary" disabled={swr.isValidating} onClick={() => void swr.mutate()}>
                        {t('Retry')}
                    </Button>
                </AlertDescription>
            </Alert>}

            {!data && swr.isLoading && <p role="status" className="text-sm text-muted-foreground">
                {t('Loading FXServer builds…')}
            </p>}

            {data && <>
                {data.providerManaged && <Alert>
                    <AlertTitle>{t('Your hosting provider manages FXServer builds')}</AlertTitle>
                    <AlertDescription>
                        {t('{provider} keeps the game server on its own build, so builds cannot be downloaded or switched here.', {
                            provider: data.providerName ?? t('The provider'),
                        })}
                    </AlertDescription>
                </Alert>}

                {data.lastError?.type === 'rolledBack' && <Alert variant="warning">
                    <AlertTitle>{t('Server returned to build {build}', { build: data.lastError.to })}</AlertTitle>
                    <AlertDescription>
                        {t('Build {from} failed to start twice, so the server went back to build {to}.', {
                            from: data.lastError.from,
                            to: data.lastError.to,
                        })}
                    </AlertDescription>
                </Alert>}
                {data.lastError?.type === 'fellBack' && <Alert variant="warning">
                    <AlertTitle>{t('Build {build} could not be used', { build: data.lastError.build })}</AlertTitle>
                    <AlertDescription>
                        {t('Build {build} is missing or broken, so the server started on the panel build {hostBuild}. Delete it and download it again.', {
                            build: data.lastError.build,
                            hostBuild: data.lastError.hostBuild,
                        })}
                    </AlertDescription>
                </Alert>}

                <StatusSection
                    data={data}
                    disabled={disabled}
                    onRollback={() => confirmSwitch('rollback', data.previousBuild)}
                />

                <DownloadSection
                    data={data}
                    disabled={locked || (busyAction !== null && busyAction !== 'cancel')}
                    onCancel={() => void postAction('cancel', {}, t('Download cancelled.'))}
                    onDismiss={() => void postAction('dismiss', {})}
                    onRetry={startDownload}
                />

                {data.sourcesError && <Alert variant="warning">
                    <AlertDescription className="flex flex-col items-start gap-3">
                        <span>{t('Could not load the build lists from Cfx.re.')}</span>
                        <Button size="sm" variant="secondary" disabled={isRefreshing} onClick={() => void refreshLists()}>
                            {t('Retry')}
                        </Button>
                    </AlertDescription>
                </Alert>}

                <section className="flex flex-col gap-3">
                    <ListHeading
                        title={t('Recommended builds')}
                        description={data.platform === 'windows'
                            ? t('The builds Cfx.re currently suggests for Windows servers.')
                            : t('The builds Cfx.re currently suggests for Linux servers.')}
                    />
                    {data.channelBuilds.length
                        ? <ListRows>
                            {data.channelBuilds.map((item) => <CatalogRow
                                key={item.build}
                                item={item}
                                data={data}
                                disabled={disabled}
                                onUse={(build) => confirmSwitch('activate', build)}
                                onDownload={startDownload}
                            />)}
                        </ListRows>
                        : <EmptyState
                            message={t('No recommended builds to show.')}
                            action={<Button size="sm" variant="secondary" disabled={isRefreshing} onClick={() => void refreshLists()}>{t('Retry')}</Button>}
                        />}
                </section>

                <section className="flex flex-col gap-3">
                    <ListHeading
                        title={t('Installed builds')}
                        description={t('Builds stored on this machine. The panel build is always available.')}
                    />
                    <ListRows>
                        <ListRow className="flex-col items-stretch sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                <span className="text-sm font-medium tabular-nums text-white">{data.hostBuild}</span>
                                <span className="text-dense text-muted-foreground">{t('Panel build (built in)')}</span>
                                {data.activeBuild === null && <Badge variant="success">{t('In use')}</Badge>}
                                {data.activeBuild !== null && data.previousBuild === null && <Badge>{t('Previous')}</Badge>}
                            </div>
                            {data.activeBuild !== null && <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={disabled}
                                    aria-label={t('Use the panel build {build}', { build: data.hostBuild })}
                                    onClick={() => confirmSwitch('activate', null)}
                                >
                                    {t('Use')}
                                </Button>
                            </div>}
                        </ListRow>
                        {data.installed.map((item) => <InstalledRow
                            key={item.build}
                            item={item}
                            disabled={disabled}
                            onUse={(build) => confirmSwitch('activate', build)}
                            onDelete={confirmDelete}
                        />)}
                    </ListRows>
                    {!data.installed.length && <EmptyState message={t('No downloaded builds yet. Download one from the lists on this page.')} />}
                </section>

                <section className="flex flex-col gap-3">
                    <ListHeading
                        title={t('Recent builds')}
                        description={t('The newest builds Cfx.re has published, newest first.')}
                    />
                    {data.recentBuilds.length
                        ? <ListRows>
                            {data.recentBuilds.map((item) => <CatalogRow
                                key={item.build}
                                item={item}
                                data={data}
                                disabled={disabled}
                                onUse={(build) => confirmSwitch('activate', build)}
                                onDownload={startDownload}
                            />)}
                        </ListRows>
                        : <EmptyState
                            message={t('No recent builds to show.')}
                            action={<Button size="sm" variant="secondary" disabled={isRefreshing} onClick={() => void refreshLists()}>{t('Retry')}</Button>}
                        />}
                </section>
            </>}
        </div>
    </div>;
}
