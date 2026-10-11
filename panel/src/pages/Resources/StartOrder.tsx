import type { ResourceBootEntry } from '@shared/resourceManagerTypes';
import { ListRow, ListRows } from '@/components/ListRow';
import EmptyState from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/i18n';

//Resources that take longer than this to start are flagged
export const SLOW_START_MS = 1000;

const formatNumber = (value: number) => value.toLocaleString(window.txBrowserLocale);

type StartOrderProps = {
    bootOrder: ResourceBootEntry[] | null;
};

/**
 * The order resources started in during the last boot, with each one's start time.
 */
export default function StartOrder({ bootOrder }: StartOrderProps) {
    if (!bootOrder?.length) {
        return <EmptyState message={t('The server has not booted yet.')} />;
    }

    const slowCount = bootOrder.filter((entry) => entry.duration > SLOW_START_MS).length;
    const totalMs = bootOrder.reduce((total, entry) => total + Math.max(0, entry.duration), 0);
    return <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{t('{count} resources started', { count: formatNumber(bootOrder.length) })}</span>
            <span className="tabular-nums">{t('{duration} ms in total', { duration: formatNumber(totalMs) })}</span>
            {slowCount > 0 && <span className="tabular-nums">{t('Slow starts: {count}', { count: formatNumber(slowCount) })}</span>}
        </div>
        <ListRows aria-label={t('Start order')}>
            {bootOrder.map((entry) => {
                const isSlow = entry.duration > SLOW_START_MS;
                return <ListRow key={`${entry.position}-${entry.resource}`}>
                    <span className="w-8 shrink-0 text-right font-mono text-dense tabular-nums text-muted-foreground">
                        {entry.position}
                    </span>
                    <span className="min-w-0 flex-1 break-all font-mono text-dense text-white">{entry.resource}</span>
                    {isSlow && <Badge variant="warning">{t('Slow start')}</Badge>}
                    <span className="shrink-0 text-right text-dense tabular-nums text-body">
                        {entry.duration >= 0
                            ? t('{duration} ms', { duration: formatNumber(entry.duration) })
                            : t('Unknown')}
                    </span>
                </ListRow>;
            })}
        </ListRows>
    </div>;
}
