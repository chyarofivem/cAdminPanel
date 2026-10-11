import type { FxBuildChannel, FxBuildDownloadProgress } from '@shared/fxBuildTypes';

const units = ['B', 'KB', 'MB', 'GB'] as const;

const unitIndexFor = (bytes: number) => {
    let index = 0;
    let value = Math.max(0, bytes);
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index++;
    }
    return index;
};

const formatInUnit = (bytes: number, index: number) => {
    const value = Math.max(0, bytes) / 1024 ** index;
    return value.toLocaleString(window.txBrowserLocale, {
        maximumFractionDigits: index === 0 || value >= 10 ? 0 : 1,
    });
};

/**
 * Human size, eg. `98 MB` or `1.4 GB`.
 */
export const formatBytes = (bytes: number) => {
    const index = unitIndexFor(bytes);
    return `${formatInUnit(bytes, index)} ${units[index]}`;
};

/**
 * A progress pair in the unit of the total, eg. `45 / 98 MB`.
 */
export const formatBytePair = (current: number, total: number | null) => {
    if (!total) return formatBytes(current);
    const index = unitIndexFor(total);
    return `${formatInUnit(current, index)} / ${formatInUnit(total, index)} ${units[index]}`;
};

export const isDownloadRunning = (download: FxBuildDownloadProgress | null | undefined) => {
    return !!download && (
        download.phase === 'downloading'
        || download.phase === 'extracting'
        || download.phase === 'installing'
    );
};

export const channelBadgeVariant = (channel: FxBuildChannel) => {
    if (channel === 'recommended') return 'success' as const;
    if (channel === 'latest') return 'info' as const;
    if (channel === 'critical') return 'warning' as const;
    return 'default' as const;
};
