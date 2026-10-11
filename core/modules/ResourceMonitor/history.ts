import { z } from 'zod';
import type {
    ResourceMonitorAlert,
    ResourceMonitorHistory,
    ResourceMonitorSample,
} from '@shared/resourceMonitorTypes';
import { ALERT_LOG_LIMIT, emptyAlertState, sanitizeAlertState, type AlertTrackerState } from './alerts';

export const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;
//Resources kept per sample in memory and on disk
export const HISTORY_STORED_PER_SAMPLE = 30;
//Resources sent per sample to the panel
export const HISTORY_PAYLOAD_PER_SAMPLE = 15;
export const DATA_FILE_VERSION = 1;

export type HistoryEntry = {
    ts: number;
    resources: { name: string; msPerTick: number }[];
};

export type PersistedData = {
    latest: ResourceMonitorSample | null;
    history: HistoryEntry[];
    alerts: ResourceMonitorAlert[];
    alertState: AlertTrackerState;
};


/**
 * Reduces a full sample to its history entry (heaviest resources only).
 */
export const toHistoryEntry = (sample: ResourceMonitorSample, limit = HISTORY_STORED_PER_SAMPLE): HistoryEntry => ({
    ts: sample.ts,
    resources: [...sample.resources]
        .sort((a, b) => b.msPerTick - a.msPerTick)
        .slice(0, limit)
        .map((resource) => ({ name: resource.name, msPerTick: resource.msPerTick })),
});


/**
 * Drops entries older than the retention window and keeps them sorted by time.
 */
export const pruneHistory = (entries: HistoryEntry[], now: number) => {
    const cutoff = now - HISTORY_RETENTION_MS;
    return entries
        .filter((entry) => entry.ts >= cutoff && entry.ts <= now + 60_000)
        .sort((a, b) => a.ts - b.ts);
};


/**
 * Builds the compact history payload: a name table plus [nameIndex, msPerTick] pairs.
 */
export const buildHistoryPayload = (
    entries: HistoryEntry[],
    perSample = HISTORY_PAYLOAD_PER_SAMPLE,
): ResourceMonitorHistory => {
    const names: string[] = [];
    const nameIndex = new Map<string, number>();
    const points = entries.map((entry) => ({
        ts: entry.ts,
        values: entry.resources.slice(0, perSample).map((resource) => {
            let index = nameIndex.get(resource.name);
            if (index === undefined) {
                index = names.length;
                names.push(resource.name);
                nameIndex.set(resource.name, index);
            }
            return [index, resource.msPerTick] as [number, number];
        }),
    }));
    return { names, points };
};


//MARK: Persisted file
const finiteNumber = z.number().finite();
const sampleSchema = z.object({
    ts: finiteNumber,
    ticks: finiteNumber,
    ticksFromTrace: z.boolean(),
    requestedFrames: finiteNumber,
    durationMs: finiteNumber,
    trigger: z.enum(['schedule', 'manual']),
    resources: z.array(z.object({
        name: z.string(),
        totalMs: finiteNumber,
        msPerTick: finiteNumber,
        peakMs: finiteNumber,
        topCauses: z.array(z.object({
            name: z.string(),
            ms: finiteNumber,
        })),
    })),
});
const historyEntrySchema = z.object({
    ts: finiteNumber,
    resources: z.array(z.object({
        name: z.string(),
        msPerTick: finiteNumber,
    })),
});
const alertSchema = z.object({
    id: z.string(),
    ts: finiteNumber,
    resource: z.string(),
    msPerTick: finiteNumber,
    thresholdMs: finiteNumber,
    consecutive: finiteNumber,
    discord: z.enum(['sent', 'off', 'notConfigured', 'notReady']),
});

export const emptyPersistedData = (): PersistedData => ({
    latest: null,
    history: [],
    alerts: [],
    alertState: emptyAlertState(),
});


/**
 * Parses the persisted file, keeping every valid part and dropping the rest.
 */
export const parsePersistedData = (input: unknown, now: number): PersistedData => {
    const data = emptyPersistedData();
    if (!input || typeof input !== 'object') return data;
    const raw = input as Record<string, unknown>;
    if (raw.version !== DATA_FILE_VERSION) return data;

    const latest = sampleSchema.safeParse(raw.latest);
    if (latest.success && now - latest.data.ts <= HISTORY_RETENTION_MS) {
        data.latest = latest.data;
    }
    if (Array.isArray(raw.history)) {
        const entries: HistoryEntry[] = [];
        for (const item of raw.history) {
            const parsed = historyEntrySchema.safeParse(item);
            if (parsed.success) entries.push(parsed.data);
        }
        data.history = pruneHistory(entries, now);
    }
    if (Array.isArray(raw.alerts)) {
        const alerts: ResourceMonitorAlert[] = [];
        for (const item of raw.alerts) {
            const parsed = alertSchema.safeParse(item);
            if (parsed.success) alerts.push(parsed.data);
        }
        data.alerts = alerts.sort((a, b) => a.ts - b.ts).slice(-ALERT_LOG_LIMIT);
    }
    data.alertState = sanitizeAlertState(raw.alertState);
    return data;
};


/**
 * The object written to disk.
 */
export const serializePersistedData = (data: PersistedData) => ({
    version: DATA_FILE_VERSION,
    latest: data.latest,
    history: data.history,
    alerts: data.alerts,
    alertState: data.alertState,
});
