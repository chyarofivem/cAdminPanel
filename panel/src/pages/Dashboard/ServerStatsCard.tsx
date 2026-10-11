import { memo, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { dashPerfCursorAtom, dashServerStatsAtom, dashSvRuntimeAtom, useGetDashDataAge } from './dashboardHooks';
import { dateToLocaleDateString, dateToLocaleTimeString, isDateToday } from '@/lib/dateTime';
import Section from '@/components/Section';
import UsageBar from '@/components/UsageBar';
import { t } from '@/lib/i18n';

/**
 * Formats a megabyte value in human units: MB below 1 GB, GB above.
 */
const formatMemory = (mb: number) => {
    return mb >= 1024
        ? `${(mb / 1024).toFixed(1)} GB`
        : `${Math.round(mb)} MB`;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="truncate text-dense text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</p>
        </div>
    );
}

//NOTE: null and undefined are semantically equal here
type HostStatsDataProps = {
    uptimePct: number | null | undefined;
    medianPlayerCount: number | null | undefined;
    fxsMemory: number | null | undefined;
    nodeMemory: {
        used: number;
        limit: number;
    } | null | undefined;
};

const HostStatsData = memo(({ uptimePct, medianPlayerCount, fxsMemory, nodeMemory }: HostStatsDataProps) => {
    const uptimePart = uptimePct ? uptimePct.toFixed(2) + '%' : '--';
    const medianPlayerPart = medianPlayerCount ? Math.ceil(medianPlayerCount) : '--';
    const fxsPart = fxsMemory ? formatMemory(fxsMemory) : '--';

    //Node.js has a heap limit, so its memory is a usage bar that turns warning and danger as it fills.
    let nodeValueLabel = '--';
    let nodeMemoryUsage = 0;
    if (nodeMemory) {
        nodeMemoryUsage = Math.ceil(nodeMemory.used / nodeMemory.limit * 100);
        nodeValueLabel = `${formatMemory(nodeMemory.used)} / ${formatMemory(nodeMemory.limit)} (${nodeMemoryUsage}%)`;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Stat label={t('Uptime 24h')} value={uptimePart} />
                <Stat label={t('Median Players 24h')} value={medianPlayerPart} />
                <Stat label={t('FXServer Memory')} value={fxsPart} />
            </div>
            <div title={nodeMemory ? `${nodeMemory.used.toFixed(2)}MB / ${nodeMemory.limit}MB` : ''}>
                <UsageBar
                    label={t('Node.js Memory')}
                    valueLabel={nodeValueLabel}
                    percent={nodeMemoryUsage}
                />
            </div>
        </div>
    );
});


export default function ServerStatsCard() {
    const pastStatsData = useAtomValue(dashServerStatsAtom);
    const svRuntimeData = useAtomValue(dashSvRuntimeAtom);
    const perfCursorData = useAtomValue(dashPerfCursorAtom);
    const getDashDataAge = useGetDashDataAge();

    const displayData = useMemo(() => {
        //Data availability & age check
        const dataAge = getDashDataAge();
        if (!svRuntimeData || dataAge.isExpired) return null;

        if (perfCursorData && perfCursorData.snap) {
            const timeStr = dateToLocaleTimeString(perfCursorData.snap.end, '2-digit', '2-digit');
            const dateStr = dateToLocaleDateString(perfCursorData.snap.end, 'short');
            const titleTimeIndicator = isDateToday(perfCursorData.snap.end) ? timeStr : `${timeStr} - ${dateStr}`;
            return {
                fxsMemory: perfCursorData.snap.fxsMemory,
                nodeMemory: svRuntimeData.nodeMemory && perfCursorData.snap.nodeMemory ? {
                    used: perfCursorData.snap.nodeMemory,
                    limit: svRuntimeData.nodeMemory.limit,
                } : null,
                titleTimeIndicator: (<>
                    (<span className="font-mono text-xs tabular-nums text-warning-text">{titleTimeIndicator}</span>)
                </>)
            };
        } else {
            return {
                fxsMemory: svRuntimeData.fxsMemory,
                nodeMemory: svRuntimeData.nodeMemory,
                titleTimeIndicator: dataAge.isStale ? t('(minutes ago)') : t('(live)'),
            };
        }
    }, [svRuntimeData, perfCursorData]);

    //Rendering
    let titleNode: React.ReactNode = null;
    let contentNode: React.ReactNode = null;
    if (displayData) {
        titleNode = displayData.titleTimeIndicator;
        contentNode = <HostStatsData
            fxsMemory={displayData.fxsMemory}
            medianPlayerCount={pastStatsData?.medianPlayerCount}
            uptimePct={pastStatsData?.uptimePct}
            nodeMemory={displayData.nodeMemory}
        />;
    } else {
        contentNode = (
            <p role="status" className="text-sm text-muted-foreground">{t('Loading…')}</p>
        )
    }

    return (
        <Section
            title={<>
                {t('Server stats')}{' '}
                <span className="text-dense font-normal text-muted-foreground">{titleNode}</span>
            </>}
        >
            {contentNode}
        </Section>
    );
}
