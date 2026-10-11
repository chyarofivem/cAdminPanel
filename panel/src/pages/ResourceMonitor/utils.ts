import type { ResourceMonitorErrorCode, ResourceMonitorHistory } from '@shared/resourceMonitorTypes';
import { t } from '@/lib/i18n';

/**
 * Chart series colours. Chart series never follow the accent (docs/design-system.md),
 * so this fixed palette is the series token set. The order keeps neighbours apart for
 * colour-blind readers: sky, amber, rose, violet, emerald.
 */
export const SERIES_COLORS = ['#38bdf8', '#fbbf24', '#fb7185', '#a78bfa', '#34d399'] as const;

/**
 * Formats a millisecond value: two decimals under 1 ms, one decimal above.
 */
export const formatMs = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    const decimals = Math.abs(value) < 1 ? 2 : 1;
    return Number(value.toFixed(decimals)).toLocaleString(window.txBrowserLocale, {
        maximumFractionDigits: decimals,
    });
};

/**
 * "just now", "2 min ago", "3 h ago"
 */
export const formatAgo = (ms: number) => {
    const minutes = Math.floor(Math.max(0, ms) / 60_000);
    if (minutes < 1) return t('just now');
    if (minutes < 60) return t('{count} min ago', { count: minutes });
    return t('{count} h ago', { count: Math.floor(minutes / 60) });
};

/**
 * "in under a minute", "in 3 min", "in 1 h"
 */
export const formatIn = (ms: number) => {
    const minutes = Math.ceil(Math.max(0, ms) / 60_000);
    if (minutes <= 1) return t('in under a minute');
    if (minutes < 60) return t('in {count} min', { count: minutes });
    return t('in {count} h', { count: Math.round(minutes / 60) });
};

export const errorMessages: Record<ResourceMonitorErrorCode | 'no_permission' | 'invalid_request' | 'save_failed', string> = {
    server_offline: 'The server is offline.',
    server_booting: 'The server is still starting.',
    not_configured: 'The server data folder is not configured.',
    already_sampling: 'A sample is already running.',
    command_failed: 'The profiler command could not be sent.',
    file_timeout: 'The profiler file did not appear in time.',
    invalid_trace: 'The profiler file could not be read.',
    no_resource_events: 'The capture held no resource events.',
    unknown: 'The sample could not be started.',
    no_permission: 'You do not have permission to do this.',
    invalid_request: 'Check the values and try again.',
    save_failed: 'The settings could not be saved.',
};

export const errorMessage = (code: string | undefined, fallback: string) => {
    if (code && code in errorMessages) return t(errorMessages[code as keyof typeof errorMessages]);
    return t(fallback);
};

export type ChartSeries = {
    name: string;
    color: string;
    average: number;
    //null where the resource is missing from a sample
    values: (number | null)[];
};

/**
 * Picks the heaviest resources by their average ms per tick over the history.
 * A resource missing from a sample counts as 0 for the average.
 */
export const pickHeaviestSeries = (history: ResourceMonitorHistory, limit = SERIES_COLORS.length): ChartSeries[] => {
    const pointCount = history.points.length;
    if (!pointCount) return [];
    const sums = new Map<number, number>();
    for (const point of history.points) {
        for (const [index, value] of point.values) {
            sums.set(index, (sums.get(index) ?? 0) + value);
        }
    }
    const top = [...sums.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
    return top.map(([nameIndex, sum], seriesIndex) => ({
        name: history.names[nameIndex] ?? '?',
        color: SERIES_COLORS[seriesIndex % SERIES_COLORS.length],
        average: sum / pointCount,
        values: history.points.map((point) => {
            const found = point.values.find(([index]) => index === nameIndex);
            return found ? found[1] : null;
        }),
    }));
};

/**
 * Rounds the axis maximum up to a clean step and returns its ticks.
 */
export const niceAxis = (maxValue: number, targetTicks = 4) => {
    const safeMax = maxValue > 0 && Number.isFinite(maxValue) ? maxValue : 1;
    const rawStep = safeMax / targetTicks;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / magnitude;
    const stepFactor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
    const step = stepFactor * magnitude;
    const max = Math.ceil(safeMax / step) * step;
    const ticks: number[] = [];
    for (let value = 0; value <= max + step / 2; value += step) {
        ticks.push(Number(value.toFixed(6)));
    }
    return { max, ticks };
};
