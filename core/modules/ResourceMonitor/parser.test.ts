import { describe, expect, it } from 'vitest';
import { parseProfilerTrace, splitResourceEventName } from './parser';

//Builders for Chrome trace events (ts in microseconds)
const B = (name: string, ts: number, tid = 1, pid = 1) => ({ ph: 'B', cat: 'blink.user_timing', name, ts, pid, tid });
const E = (ts: number, tid = 1, name?: string, pid = 1) => ({ ph: 'E', cat: 'blink.user_timing', ts, pid, tid, ...(name ? { name } : {}) });
const frame = (ts: number, tid = 1, pid = 1) => ({ ph: 'I', name: 'BeginFrame', ts, pid, tid, s: 't' });

const known = ['resA', 'resB', 'resC'];

const getResource = (result: ReturnType<typeof parseProfilerTrace>, name: string) => {
    if (!result.ok) throw new Error(`parse failed: ${result.reason}`);
    const found = result.trace.resources.find((resource) => resource.name === name);
    if (!found) throw new Error(`resource ${name} not found`);
    return found;
};


describe('splitResourceEventName', () => {
    it('splits the trailing resource group and keeps parentheses in the cause', () => {
        expect(splitResourceEventName('tick (resA)')).toEqual({ cause: 'tick', resource: 'resA' });
        expect(splitResourceEventName('event:foo (bar) (resA)', new Set(known))).toEqual({ cause: 'event:foo (bar)', resource: 'resA' });
    });

    it('treats unknown or implausible groups as scopes', () => {
        expect(splitResourceEventName('scope with (parens)', new Set(known))).toBeNull();
        expect(splitResourceEventName('native call (0x1234 abc)')).toBeNull();
        expect(splitResourceEventName('plain scope')).toBeNull();
        expect(splitResourceEventName('empty ()')).toBeNull();
    });

    it('accepts the resource first when only the leading part is a known resource', () => {
        expect(splitResourceEventName('resA (tick)', new Set(known))).toEqual({ cause: 'tick', resource: 'resA' });
        //The trailing group still wins when it is the known one
        expect(splitResourceEventName('resB (resA)', new Set(known))).toEqual({ cause: 'resB', resource: 'resA' });
    });
});


describe('parseProfilerTrace', () => {
    const mainTrace = {
        traceEvents: [
            //Metadata and unknown events are ignored
            { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'svMain' } },
            { ph: 'X', name: 'complete (resA)', ts: 50, dur: 99999, pid: 1, tid: 1 },
            null,
            'garbage',
            { ph: 'B', name: 'missing ts (resA)', pid: 1, tid: 1 },

            //Tick 0 on the main thread
            frame(0),
            B('tick (resA)', 100),
            B('scope with (parens)', 200),
            E(700),
            B('export:getData (resB)', 1000),
            B('GetPlayerName', 1200),
            E(1500),
            E(3000),
            E(5100),

            //Tick 1
            frame(10_000),
            B('tick (resA)', 10_100),
            E(11_100),
            B('event:foo (bar) (resC)', 12_000),
            E(18_000),

            //Tick 2: an unmatched end and a begin that never ends
            frame(20_000),
            B('tick (resA)', 20_100),
            E(20_600),
            E(21_000),
            B('tick (resB)', 25_000),
            B('inner scope', 26_000),
            E(27_000, 1, 'inner scope'),

            //A second thread with fewer frames
            frame(0, 2),
            B('thread (resC)', 500, 2),
            E(1_500, 2),
        ],
    };

    it('computes self time, ticks, peaks and causes', () => {
        const result = parseProfilerTrace(mainTrace, { requestedFrames: 100, knownResources: known });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.trace.ticks).toBe(3);
        expect(result.trace.ticksFromTrace).toBe(true);
        expect(result.trace.unmatchedEnd).toBe(1);
        expect(result.trace.unmatchedBegin).toBe(1);
        expect(result.trace.durationMs).toBe(27);
        expect(result.trace.resources.map((resource) => resource.name)).toEqual(['resC', 'resA', 'resB']);

        //Nested resB export is removed from resA, the scopes stay inside resA
        const resA = getResource(result, 'resA');
        expect(resA.totalMs).toBe(4.5);
        expect(resA.msPerTick).toBe(1.5);
        expect(resA.peakMs).toBe(3);
        expect(resA.topCauses).toEqual([{ name: 'tick', ms: 4.5 }]);

        //The unclosed begin is closed at the last event of its thread
        const resB = getResource(result, 'resB');
        expect(resB.totalMs).toBe(4);
        expect(resB.msPerTick).toBe(1.333);
        expect(resB.peakMs).toBe(2);
        expect(resB.topCauses).toEqual([
            { name: 'export:getData', ms: 2 },
            { name: 'tick', ms: 2 },
        ]);

        //Events from the second thread count, and a cause may hold parentheses
        const resC = getResource(result, 'resC');
        expect(resC.totalMs).toBe(7);
        expect(resC.msPerTick).toBe(2.333);
        expect(resC.peakMs).toBe(6);
        expect(resC.topCauses).toEqual([
            { name: 'event:foo (bar)', ms: 6 },
            { name: 'thread', ms: 1 },
        ]);
    });

    it('treats a plausible group as a resource without a known list', () => {
        const result = parseProfilerTrace(mainTrace, { requestedFrames: 100 });
        const parens = getResource(result, 'parens');
        expect(parens.totalMs).toBe(0.5);
        //The scope time moved out of resA
        expect(getResource(result, 'resA').totalMs).toBe(4);
    });

    it('splits self segments across ticks by their start', () => {
        const result = parseProfilerTrace({
            traceEvents: [
                frame(0),
                B('tick (resA)', 1_000),
                B('export:x (resB)', 2_000),
                frame(5_000),
                E(8_000),
                E(9_000),
                frame(10_000),
            ],
        }, { requestedFrames: 10, knownResources: known });
        const resA = getResource(result, 'resA');
        //1ms before the export (tick 0) and 1ms after it (tick 1)
        expect(resA.totalMs).toBe(2);
        expect(resA.peakMs).toBe(1);
        expect(getResource(result, 'resB').peakMs).toBe(6);
    });

    it('closes frames that never ended when a named end matches a deeper frame', () => {
        const result = parseProfilerTrace({
            traceEvents: [
                frame(0),
                B('tick (resA)', 0),
                B('scope never closed', 100),
                B('export:y (resB)', 200),
                E(1_000, 1, 'tick (resA)'),
            ],
        }, { requestedFrames: 10, knownResources: known });
        if (!result.ok) throw new Error('parse failed');
        expect(result.trace.unmatchedBegin).toBe(2);
        expect(getResource(result, 'resA').totalMs).toBe(0.2);
        expect(getResource(result, 'resB').totalMs).toBe(0.8);
    });

    it('falls back to the requested frames without BeginFrame events', () => {
        const result = parseProfilerTrace({
            traceEvents: [
                B('tick (resA)', 0),
                E(2_000),
                B('tick (resA)', 5_000),
                E(5_500),
            ],
        }, { requestedFrames: 50, knownResources: known });
        if (!result.ok) throw new Error('parse failed');
        expect(result.trace.ticks).toBe(50);
        expect(result.trace.ticksFromTrace).toBe(false);
        const resA = getResource(result, 'resA');
        expect(resA.msPerTick).toBe(0.05);
        //Peak is the largest single call
        expect(resA.peakMs).toBe(2);
    });

    it('accepts a bare event array and string timestamps', () => {
        const result = parseProfilerTrace([
            frame(0),
            { ph: 'B', name: 'tick (resA)', ts: '100', tid: 1, pid: 1 },
            { ph: 'E', ts: '1100', tid: 1, pid: 1 },
        ], { requestedFrames: 1 });
        expect(getResource(result, 'resA').totalMs).toBe(1);
    });

    it('retries without the known list when it matches nothing', () => {
        const result = parseProfilerTrace({
            traceEvents: [frame(0), B('tick (newResource)', 0), E(1_000)],
        }, { requestedFrames: 1, knownResources: ['someOtherResource'] });
        expect(getResource(result, 'newResource').totalMs).toBe(1);
    });

    it('reports a trace without resource events', () => {
        const result = parseProfilerTrace({
            traceEvents: [frame(0), B('only a scope', 0), E(1_000), frame(16_000)],
        }, { requestedFrames: 10, knownResources: known });
        expect(result).toEqual({ ok: false, reason: 'no_resource_events', eventCount: 4 });
    });

    it('rejects input that is not a trace', () => {
        expect(parseProfilerTrace(null, { requestedFrames: 10 })).toMatchObject({ ok: false, reason: 'invalid_trace' });
        expect(parseProfilerTrace({ foo: [] }, { requestedFrames: 10 })).toMatchObject({ ok: false, reason: 'invalid_trace' });
        expect(parseProfilerTrace('text', { requestedFrames: 10 })).toMatchObject({ ok: false, reason: 'invalid_trace' });
        expect(parseProfilerTrace({ traceEvents: [] }, { requestedFrames: 10 })).toMatchObject({ ok: false, reason: 'no_resource_events' });
    });
});
