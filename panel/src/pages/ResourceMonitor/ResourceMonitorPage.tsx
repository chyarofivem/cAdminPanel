import { useEffect, useState } from 'react';
import useSWR from 'swr';
import type {
    ResourceMonitorActionResp,
    ResourceMonitorAlert,
    ResourceMonitorDataResp,
    ResourceMonitorDiscordDelivery,
    ResourceMonitorResourceStat,
    ResourceMonitorStatus,
} from '@shared/resourceMonitorTypes';
import { PageHeader } from '@/components/page-header';
import Section from '@/components/Section';
import { ListRow, ListRows } from '@/components/ListRow';
import UsageBar from '@/components/UsageBar';
import EmptyState from '@/components/EmptyState';
import TxAnchor from '@/components/TxAnchor';
import { txToast } from '@/components/TxToaster';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminPerms } from '@/hooks/auth';
import { useAuthedFetcher } from '@/hooks/fetch';
import { tsToLocaleDateTimeString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';
import HistoryChart from './HistoryChart';
import SettingsForm from './SettingsForm';
import { errorMessage, formatAgo, formatIn, formatMs } from './utils';

type MonitorData = Exclude<ResourceMonitorDataResp, { error: string }> & { receivedAt: number };

const LATEST_VISIBLE = 20;
const POLL_SAMPLING_MS = 2_000;
const POLL_IDLE_MS = 30_000;

const discordBadges: Record<ResourceMonitorDiscordDelivery, { label: string; variant: BadgeProps['variant'] }> = {
    sent: { label: 'Sent to Discord', variant: 'success' },
    notConfigured: { label: 'Discord not configured', variant: 'default' },
    notReady: { label: 'Discord not connected', variant: 'warning' },
    off: { label: 'Discord alerts off', variant: 'default' },
};

const getStatusBadge = (status: ResourceMonitorStatus): { label: string; variant: BadgeProps['variant'] } => {
    if (status.state === 'sampling') return { label: t('Sampling'), variant: 'info' };
    if (status.state === 'disabled') return { label: t('Paused'), variant: 'default' };
    if (status.state === 'serverOffline') {
        return status.server === 'booting'
            ? { label: t('Server starting'), variant: 'warning' }
            : { label: t('Server offline'), variant: 'warning' };
    }
    return { label: t('Active'), variant: 'success' };
};


//A heading for a block of list rows: rows never go inside a card
function BlockHeading({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
    return <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight text-white">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
    </div>;
}


function StatusLine({ data, serverNow }: { data: MonitorData; serverNow: number }) {
    const { status, config } = data;
    const badge = getStatusBadge(status);
    const parts: string[] = [];

    if (status.state === 'sampling') {
        parts.push(t('Capturing {count} server ticks…', { count: config.frames }));
        if (status.samplingStartedAt) {
            const remainingMs = status.samplingStartedAt + status.samplingExpectedMs - serverNow;
            if (remainingMs > 1_000) parts.push(t('about {count} s left', { count: Math.ceil(remainingMs / 1000) }));
        }
    } else if (status.state === 'disabled') {
        parts.push(t('Automatic sampling is paused'));
    } else if (status.state === 'serverOffline') {
        parts.push(status.server === 'booting'
            ? t('Sampling starts once the server is up')
            : t('Sampling resumes when the server is running'));
    } else {
        parts.push(config.intervalMinutes === 60
            ? t('Sampling every hour')
            : t('Sampling every {count} min', { count: config.intervalMinutes }));
    }

    if (status.state !== 'sampling') {
        parts.push(status.lastSampleAt
            ? t('last sample {time}', { time: formatAgo(serverNow - status.lastSampleAt) })
            : t('no samples yet'));
    }
    if (status.state === 'waiting' && status.nextSampleAt) {
        parts.push(t('next {time}', { time: formatIn(status.nextSampleAt - serverNow) }));
    }

    return <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <p className="text-sm tabular-nums text-muted-foreground">{parts.join(', ')}</p>
    </div>;
}


function ResourceRow({ resource, thresholdMs }: { resource: ResourceMonitorResourceStat; thresholdMs: number }) {
    const isOver = resource.msPerTick >= thresholdMs;
    const topCause = resource.topCauses[0];
    return <ListRow className="flex-col items-stretch gap-3 md:flex-row md:items-center">
        <div className="min-w-0 md:w-2/5">
            <div className="flex flex-wrap items-center gap-2">
                <p className="break-all font-medium text-white">{resource.name}</p>
                {isOver && <Badge variant="warning">{t('Over threshold')}</Badge>}
            </div>
            <p
                className="mt-1 truncate text-dense tabular-nums text-muted-foreground"
                title={resource.topCauses.map((cause) => `${cause.name || t('unnamed')}: ${formatMs(cause.ms)} ms`).join('\n')}
            >
                {topCause
                    ? t('Top cause: {cause}, {value} ms in total', { cause: topCause.name || t('unnamed'), value: formatMs(topCause.ms) })
                    : t('No cause recorded')}
            </p>
        </div>
        <UsageBar
            className="md:flex-1"
            label={t('Ms per tick')}
            valueLabel={`${formatMs(resource.msPerTick)} / ${formatMs(thresholdMs)} ms`}
            percent={thresholdMs > 0 ? (resource.msPerTick / thresholdMs) * 100 : 0}
        />
        <p className="shrink-0 text-dense tabular-nums text-muted-foreground md:w-32 md:text-right">
            {t('Peak {value} ms', { value: formatMs(resource.peakMs) })}
        </p>
    </ListRow>;
}


function AlertRow({ alert }: { alert: ResourceMonitorAlert }) {
    const badge = discordBadges[alert.discord] ?? discordBadges.off;
    return <ListRow className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
            <p className="break-all font-medium text-white">{alert.resource}</p>
            <p className="text-dense tabular-nums text-muted-foreground">
                {alert.consecutive > 1
                    ? t('{value} ms per tick for {count} samples, threshold {threshold} ms', {
                        value: formatMs(alert.msPerTick),
                        count: alert.consecutive,
                        threshold: formatMs(alert.thresholdMs),
                    })
                    : t('{value} ms per tick, threshold {threshold} ms', {
                        value: formatMs(alert.msPerTick),
                        threshold: formatMs(alert.thresholdMs),
                    })}
            </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
            <span className="text-dense tabular-nums text-muted-foreground">{tsToLocaleDateTimeString(alert.ts, 'short', 'short')}</span>
            <Badge variant={badge.variant}>{t(badge.label)}</Badge>
        </div>
    </ListRow>;
}


export default function ResourceMonitorPage() {
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const canSample = hasPerm('commands.resources');
    const canEditSettings = hasPerm('settings.write');
    const canViewSettings = hasPerm('settings.view');
    const [isStarting, setIsStarting] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [clientNow, setClientNow] = useState(() => Date.now());

    const swr = useSWR('/resourceMonitor/data', async (url: string): Promise<MonitorData> => {
        const resp = await fetcher<ResourceMonitorDataResp>(url);
        if ('error' in resp) throw new Error(resp.error);
        return { ...resp, receivedAt: Date.now() };
    }, {
        revalidateOnFocus: false,
        refreshInterval: (latest) => latest?.status.state === 'sampling' ? POLL_SAMPLING_MS : POLL_IDLE_MS,
    });
    const data = swr.data;

    //Keeps the relative times moving between polls
    useEffect(() => {
        const timer = window.setInterval(() => setClientNow(Date.now()), 5_000);
        return () => window.clearInterval(timer);
    }, []);
    useEffect(() => {
        setClientNow(Date.now());
    }, [data]);

    const serverNow = data ? clientNow + (data.serverNow - data.receivedAt) : clientNow;
    const status = data?.status;
    const isSampling = status?.state === 'sampling';
    const serverOnline = status?.server === 'online';
    const sampleDisabledReason = !canSample
        ? t('You do not have permission to control resources.')
        : !data
            ? undefined
            : isSampling
                ? t('A sample is already running.')
                : !serverOnline
                    ? t('Start the server to take a sample.')
                    : undefined;
    const sampleDisabled = !data || !canSample || isStarting || isSampling || !serverOnline;

    const startSample = async () => {
        if (sampleDisabled) return;
        setIsStarting(true);
        try {
            const resp = await fetcher<ResourceMonitorActionResp>('/resourceMonitor/sample', { method: 'POST' });
            if ('error' in resp) {
                txToast.error({ title: t('Sample not started'), msg: errorMessage(resp.code, resp.error) });
                return;
            }
            txToast.success(t('Sampling started. Results appear in a few seconds.'));
            await swr.mutate();
        } catch (error) {
            txToast.error({
                title: t('Sample not started'),
                msg: t(error instanceof Error ? error.message : 'Unknown error.'),
            });
        } finally {
            setIsStarting(false);
        }
    };

    const sampleButton = (variant: 'default' | 'secondary') => <Button
        variant={variant}
        onClick={() => void startSample()}
        disabled={sampleDisabled}
        title={sampleDisabledReason}
    >
        {isSampling ? t('Sampling…') : t('Sample now')}
    </Button>;

    const latest = data?.latest ?? null;
    const thresholdMs = data?.config.alertThresholdMs ?? 0;
    const visibleResources = latest
        ? (showAll ? latest.resources : latest.resources.slice(0, LATEST_VISIBLE))
        : [];
    const showFailure = Boolean(status?.lastError && (!status.lastSampleAt || status.lastError.ts > status.lastSampleAt));
    const showSkip = Boolean(
        status?.lastSkip
        && status.lastSkip.ts > (status.lastSampleAt ?? 0)
        && status.lastSkip.code !== 'server_offline'
        && status.lastSkip.code !== 'server_booting'
    );
    const alertsNewestFirst = data ? [...data.alerts].reverse() : [];

    return <div className="pb-8">
        <PageHeader
            title={t('Resource monitor')}
            subtitle={t('Measures server script time per resource from short profiler captures.')}
        >
            {sampleButton('default')}
        </PageHeader>

        {data && <StatusLine data={data} serverNow={serverNow} />}

        <div className="flex flex-col gap-6">
            {swr.error && <Alert variant="destructive">
                <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>{t('The resource monitor could not be loaded.')}</span>
                    <Button variant="secondary" size="sm" onClick={() => void swr.mutate()} disabled={swr.isValidating}>
                        {t('Retry')}
                    </Button>
                </AlertDescription>
            </Alert>}

            {!data && swr.isLoading && <p role="status" className="text-sm text-muted-foreground">
                {t('Loading the resource monitor…')}
            </p>}

            {data && <>
                {!serverOnline && <Alert variant="warning">
                    <AlertDescription>
                        {status?.server === 'booting'
                            ? t('The server is still starting. Samples need a running server.')
                            : t('The server is offline. Start it to take samples.')}
                    </AlertDescription>
                </Alert>}

                {showFailure && status?.lastError && <Alert variant="warning">
                    <AlertDescription>
                        {t('The last sample failed: {reason}', { reason: errorMessage(status.lastError.code, 'Unknown error.') })}
                    </AlertDescription>
                </Alert>}

                {showSkip && status?.lastSkip && <p className="text-sm text-muted-foreground">
                    {t('The last scheduled sample was skipped: {reason}', { reason: errorMessage(status.lastSkip.code, 'Unknown error.') })}
                </p>}

                {/* Latest sample */}
                <section className="flex flex-col gap-3">
                    <BlockHeading
                        title={t('Latest sample')}
                        description={latest
                            ? t('Taken {time} over {count} server ticks, sorted by ms per tick.', {
                                time: formatAgo(serverNow - latest.ts),
                                count: latest.ticks,
                            })
                            : undefined}
                    />
                    {!latest && <EmptyState message={t('No samples yet.')} action={sampleButton('secondary')} />}
                    {latest && !latest.resources.length && <EmptyState message={t('The last sample found no resource activity.')} />}
                    {latest && latest.resources.length > 0 && <>
                        <ListRows>
                            {visibleResources.map((resource) => <ResourceRow key={resource.name} resource={resource} thresholdMs={thresholdMs} />)}
                        </ListRows>
                        {latest.resources.length > LATEST_VISIBLE && <div>
                            <Button variant="link" className="min-h-11 text-dense sm:min-h-0" onClick={() => setShowAll((value) => !value)}>
                                {showAll
                                    ? t('Show top {count}', { count: LATEST_VISIBLE })
                                    : t('Show all {count}', { count: latest.resources.length })}
                            </Button>
                        </div>}
                    </>}
                </section>

                {/* History */}
                <Section
                    title={t('Last 24 hours')}
                    description={t('Ms per tick of the 5 heaviest resources, with the alert threshold.')}
                >
                    <HistoryChart
                        history={data.history}
                        thresholdMs={thresholdMs}
                        intervalMinutes={data.config.intervalMinutes}
                    />
                </Section>

                {/* Alerts */}
                <section className="flex flex-col gap-3">
                    <BlockHeading
                        title={t('Alerts')}
                        description={data.config.alertConsecutive > 1
                            ? t('Resources at or above {value} ms per tick for {count} samples in a row.', {
                                value: formatMs(thresholdMs),
                                count: data.config.alertConsecutive,
                            })
                            : t('Resources at or above {value} ms per tick in a sample.', { value: formatMs(thresholdMs) })}
                    />
                    {data.config.discordAlerts && !data.discordConfigured && <p className="text-sm text-muted-foreground">
                        {t('Discord alerts are on, but the Discord bot or its warnings channel is not set up.')}
                        {canViewSettings && <>
                            {' '}
                            <TxAnchor href="/settings#discord">{t('Open Discord settings')}</TxAnchor>
                        </>}
                    </p>}
                    {alertsNewestFirst.length
                        ? <ListRows>
                            {alertsNewestFirst.map((alert) => <AlertRow key={alert.id} alert={alert} />)}
                        </ListRows>
                        : <EmptyState message={t('No alerts yet.')} />}
                </section>

                <SettingsForm
                    config={data.config}
                    canEdit={canEditSettings}
                    discordConfigured={data.discordConfigured}
                    onSaved={() => void swr.mutate()}
                />
            </>}
        </div>
    </div>;
}
