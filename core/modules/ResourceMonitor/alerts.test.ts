import { describe, expect, it } from 'vitest';
import type { ResourceMonitorAlert } from '@shared/resourceMonitorTypes';
import {
    appendAlert,
    buildAlertMessage,
    emptyAlertState,
    evaluateAlerts,
    sanitizeAlertState,
    type AlertTrackerState,
} from './alerts';

const rule = { thresholdMs: 4, consecutive: 2 };

//Runs a sequence of samples and returns the triggered names per sample
const runSamples = (samples: Record<string, number>[], sampleRule = rule) => {
    let state: AlertTrackerState = emptyAlertState();
    const triggeredPerSample: string[][] = [];
    for (const sample of samples) {
        const resources = Object.entries(sample).map(([name, msPerTick]) => ({ name, msPerTick }));
        const result = evaluateAlerts(state, resources, sampleRule);
        state = result.state;
        triggeredPerSample.push(result.triggered.map((alert) => alert.resource));
    }
    return { state, triggeredPerSample };
};


describe('evaluateAlerts', () => {
    it('alerts once the streak reaches the consecutive count', () => {
        const state = emptyAlertState();
        const first = evaluateAlerts(state, [{ name: 'resA', msPerTick: 5 }], rule);
        expect(first.triggered).toEqual([]);
        expect(first.state.streaks).toEqual({ resA: 1 });

        const second = evaluateAlerts(first.state, [{ name: 'resA', msPerTick: 6.2 }], rule);
        expect(second.triggered).toEqual([{ resource: 'resA', msPerTick: 6.2, consecutive: 2 }]);
        expect(second.state.alerted).toEqual(['resA']);

        //The input state is not mutated
        expect(state).toEqual(emptyAlertState());
        expect(first.state.streaks).toEqual({ resA: 1 });
    });

    it('does not alert again until the resource drops below the threshold', () => {
        const { triggeredPerSample, state } = runSamples([
            { resA: 5 },
            { resA: 6 },
            { resA: 7 },
            { resA: 9 },
            { resA: 3.9 },
            { resA: 4 },
            { resA: 4.5 },
        ]);
        expect(triggeredPerSample).toEqual([[], ['resA'], [], [], [], [], ['resA']]);
        expect(state.streaks).toEqual({ resA: 2 });
    });

    it('counts a missing resource as below the threshold', () => {
        const { triggeredPerSample, state } = runSamples([
            { resA: 5 },
            { resB: 1 },
            { resA: 5 },
            { resA: 5 },
        ]);
        expect(triggeredPerSample).toEqual([[], [], [], ['resA']]);
        expect(state.streaks).toEqual({ resA: 2 });
    });

    it('tracks resources independently and alerts immediately with a count of 1', () => {
        const { triggeredPerSample } = runSamples([
            { resA: 10, resB: 1 },
            { resA: 10, resB: 12 },
            { resA: 1, resB: 12 },
            { resA: 10, resB: 12 },
        ], { thresholdMs: 4, consecutive: 1 });
        expect(triggeredPerSample).toEqual([['resA'], ['resB'], [], ['resA']]);
    });

    it('ignores invalid resource entries', () => {
        const result = evaluateAlerts(emptyAlertState(), [
            { name: 'resA', msPerTick: Number.NaN },
            null as any,
            { name: 'resB', msPerTick: 50 },
        ], { thresholdMs: 4, consecutive: 1 });
        expect(result.triggered.map((alert) => alert.resource)).toEqual(['resB']);
    });
});


describe('sanitizeAlertState', () => {
    it('keeps valid entries and drops the rest', () => {
        expect(sanitizeAlertState({
            streaks: { resA: 3, resB: -1, resC: 'x', resD: 1.5 },
            alerted: ['resA', 'resB', 42],
        })).toEqual({ streaks: { resA: 3 }, alerted: ['resA'] });
        expect(sanitizeAlertState(null)).toEqual(emptyAlertState());
        expect(sanitizeAlertState('corrupt')).toEqual(emptyAlertState());
    });
});


describe('appendAlert', () => {
    it('keeps the newest entries', () => {
        let list: ResourceMonitorAlert[] = [];
        for (let i = 0; i < 55; i++) {
            list = appendAlert(list, {
                id: String(i),
                ts: i,
                resource: 'resA',
                msPerTick: 5,
                thresholdMs: 4,
                consecutive: 2,
                discord: 'off',
            });
        }
        expect(list).toHaveLength(50);
        expect(list[0].id).toBe('5');
        expect(list.at(-1)!.id).toBe('54');
    });
});


describe('buildAlertMessage', () => {
    it('writes short and specific copy', () => {
        expect(buildAlertMessage({ resource: 'resA', msPerTick: 6.234, consecutive: 2, thresholdMs: 4 }, 'console')).toEqual({
            title: 'Slow resource: resA',
            description: 'resA used 6.2 ms per server tick for 2 samples in a row (threshold 4 ms).',
        });
        expect(buildAlertMessage({ resource: 'resA', msPerTick: 12, consecutive: 1, thresholdMs: 0.75 }, 'console').description)
            .toBe('resA used 12 ms per server tick (threshold 0.75 ms).');
    });

    it('escapes markdown in the resource name for Discord only', () => {
        const input = { resource: 'my_res*', msPerTick: 5, consecutive: 2, thresholdMs: 4 };
        expect(buildAlertMessage(input, 'discord').title).toBe('Slow resource: my\\_res\\*');
        expect(buildAlertMessage(input, 'console').title).toBe('Slow resource: my_res*');
    });
});
