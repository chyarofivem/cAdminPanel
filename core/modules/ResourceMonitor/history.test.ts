import { describe, expect, it } from 'vitest';
import type { ResourceMonitorSample } from '@shared/resourceMonitorTypes';
import {
    buildHistoryPayload,
    DATA_FILE_VERSION,
    HISTORY_RETENTION_MS,
    parsePersistedData,
    pruneHistory,
    serializePersistedData,
    toHistoryEntry,
} from './history';

const now = 1_800_000_000_000;

const makeSample = (ts: number, values: Record<string, number>): ResourceMonitorSample => ({
    ts,
    ticks: 100,
    ticksFromTrace: true,
    requestedFrames: 100,
    durationMs: 5000,
    trigger: 'schedule',
    resources: Object.entries(values).map(([name, msPerTick]) => ({
        name,
        totalMs: msPerTick * 100,
        msPerTick,
        peakMs: msPerTick * 2,
        topCauses: [{ name: 'tick', ms: msPerTick * 100 }],
    })),
});


describe('history', () => {
    it('keeps the heaviest resources per entry', () => {
        const entry = toHistoryEntry(makeSample(now, { a: 1, b: 3, c: 2 }), 2);
        expect(entry).toEqual({ ts: now, resources: [{ name: 'b', msPerTick: 3 }, { name: 'c', msPerTick: 2 }] });
    });

    it('drops entries older than 24 hours and sorts by time', () => {
        const entries = [
            { ts: now - 1000, resources: [] },
            { ts: now - HISTORY_RETENTION_MS - 1, resources: [] },
            { ts: now - 5000, resources: [] },
        ];
        expect(pruneHistory(entries, now).map((entry) => entry.ts)).toEqual([now - 5000, now - 1000]);
    });

    it('builds a compact payload with a name table', () => {
        const payload = buildHistoryPayload([
            { ts: 1, resources: [{ name: 'a', msPerTick: 2 }, { name: 'b', msPerTick: 1 }] },
            { ts: 2, resources: [{ name: 'b', msPerTick: 3 }, { name: 'c', msPerTick: 1 }, { name: 'a', msPerTick: 0.5 }] },
        ], 2);
        expect(payload).toEqual({
            names: ['a', 'b', 'c'],
            points: [
                { ts: 1, values: [[0, 2], [1, 1]] },
                { ts: 2, values: [[1, 3], [2, 1]] },
            ],
        });
    });
});


describe('parsePersistedData', () => {
    it('round-trips the serialized data', () => {
        const sample = makeSample(now - 60_000, { a: 5 });
        const serialized = serializePersistedData({
            latest: sample,
            history: [toHistoryEntry(sample)],
            alerts: [{
                id: 'x',
                ts: now - 60_000,
                resource: 'a',
                msPerTick: 5,
                thresholdMs: 4,
                consecutive: 2,
                discord: 'sent',
            }],
            alertState: { streaks: { a: 2 }, alerted: ['a'] },
        });
        const parsed = parsePersistedData(JSON.parse(JSON.stringify(serialized)), now);
        expect(parsed.latest).toEqual(sample);
        expect(parsed.history).toHaveLength(1);
        expect(parsed.alerts).toHaveLength(1);
        expect(parsed.alertState).toEqual({ streaks: { a: 2 }, alerted: ['a'] });
    });

    it('tolerates corrupt or foreign files', () => {
        const empty = { latest: null, history: [], alerts: [], alertState: { streaks: {}, alerted: [] } };
        expect(parsePersistedData(null, now)).toEqual(empty);
        expect(parsePersistedData('corrupt', now)).toEqual(empty);
        expect(parsePersistedData({ version: 999, history: [] }, now)).toEqual(empty);

        const partial = parsePersistedData({
            version: DATA_FILE_VERSION,
            latest: { ts: 'yesterday' },
            history: [
                { ts: now - 1000, resources: [{ name: 'a', msPerTick: 1 }] },
                { ts: now - 500, resources: 'bad' },
                null,
            ],
            alerts: [{ id: 'bad' }],
            alertState: 'bad',
        }, now);
        expect(partial.latest).toBeNull();
        expect(partial.history).toEqual([{ ts: now - 1000, resources: [{ name: 'a', msPerTick: 1 }] }]);
        expect(partial.alerts).toEqual([]);
        expect(partial.alertState).toEqual({ streaks: {}, alerted: [] });
    });
});
