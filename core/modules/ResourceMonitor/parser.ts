import type { ResourceMonitorResourceStat } from '@shared/resourceMonitorTypes';

/**
 * Parser for the Chrome trace JSON written by the FXServer `profiler saveJSON` command.
 *
 * Relevant events (everything else is ignored):
 * - resource entry: `{ ph: 'B', name: '<cause> (<resource>)', ts, tid }` and the matching `ph: 'E'`
 *   on the same tid, properly nested (a per-tid stack);
 * - scope: the same B/E shape, `name` is the scope string only;
 * - tick start: `{ ph: 'I', name: 'BeginFrame', ts, tid }`.
 * Timestamps are in microseconds.
 */

export type ParseTraceOptions = {
    //Used as the tick count when the trace holds no BeginFrame event
    requestedFrames: number;
    //Resource names from the latest report. When set, only `(x)` with a known x counts as a resource.
    knownResources?: Iterable<string>;
    //How many causes to keep per resource
    topCausesLimit?: number;
};

export type ParsedTrace = {
    ticks: number;
    ticksFromTrace: boolean;
    durationMs: number;
    eventCount: number;
    unmatchedBegin: number;
    unmatchedEnd: number;
    //Sorted by msPerTick, heaviest first
    resources: ResourceMonitorResourceStat[];
};

export type ParseTraceResult = {
    ok: true;
    trace: ParsedTrace;
} | {
    ok: false;
    reason: 'invalid_trace' | 'no_resource_events';
    eventCount: number;
};

type NormalizedEvent = {
    ph: 'B' | 'E' | 'I';
    name: string;
    ts: number;
    threadKey: string;
    order: number;
};

type Frame = {
    id: number;
    name: string;
    resource: string | null;
    cause: string;
    //Start of the current self segment (resource frames only)
    segStart: number;
};

type ResourceAccumulator = {
    selfUs: number;
    causes: Map<string, number>;
    ticks: Map<string, number>;
};

//Greedy prefix, so a cause with parentheses keeps them and only the trailing group is the resource
const resourceNameRegex = /^(.*)\(([^()]+)\)$/;
//Without a known list, a resource name is at least a single token
const plausibleResourceRegex = /^[^\s()]{1,128}$/;

const round3 = (value: number) => Math.round(value * 1000) / 1000;

const toNumber = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const toKeyPart = (value: unknown) => {
    if (typeof value === 'number' || typeof value === 'string') return String(value);
    return '?';
};


/**
 * Splits `<cause> (<resource>)` into its parts, or returns null for a plain scope.
 */
export const splitResourceEventName = (name: string, known?: Set<string>) => {
    const match = resourceNameRegex.exec(name);
    if (!match) return null;
    const resource = match[2].trim();
    if (!resource) return null;
    if (known && known.size) {
        if (!known.has(resource)) {
            //Not confirmed against a real capture: accept `<resource> (<cause>)` as well
            const leading = match[1].trim();
            if (leading && known.has(leading)) {
                return { cause: resource, resource: leading };
            }
            return null;
        }
    } else if (!plausibleResourceRegex.test(resource)) {
        return null;
    }
    return {
        cause: match[1].trim(),
        resource,
    };
};


/**
 * Finds the index of the last frame start that is <= ts, or -1.
 */
const findTickIndex = (frameStarts: number[], ts: number) => {
    let low = 0;
    let high = frameStarts.length - 1;
    let found = -1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (frameStarts[mid] <= ts) {
            found = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return found;
};


/**
 * Normalizes the raw events, dropping anything without a usable phase, name or timestamp.
 */
const normalizeEvents = (rawEvents: unknown[]) => {
    const events: NormalizedEvent[] = [];
    for (let i = 0; i < rawEvents.length; i++) {
        const raw = rawEvents[i];
        if (!raw || typeof raw !== 'object') continue;
        const event = raw as Record<string, unknown>;
        let ph = typeof event.ph === 'string' ? event.ph : '';
        if (ph === 'i') ph = 'I';
        if (ph !== 'B' && ph !== 'E' && ph !== 'I') continue;
        const ts = toNumber(event.ts);
        if (ts === undefined) continue;
        const name = typeof event.name === 'string' ? event.name : '';
        if (ph === 'B' && !name) continue;
        if (ph === 'I' && name !== 'BeginFrame') continue;
        events.push({
            ph,
            name,
            ts,
            threadKey: `${toKeyPart(event.pid)}:${toKeyPart(event.tid)}`,
            order: i,
        });
    }
    return events;
};


/**
 * Core pass over the events, with a given resource name filter.
 */
const processEvents = (
    events: NormalizedEvent[],
    requestedFrames: number,
    known: Set<string> | undefined,
    topCausesLimit: number,
): ParsedTrace | null => {
    //Group by thread, keeping the file order for equal timestamps
    const threads = new Map<string, NormalizedEvent[]>();
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const event of events) {
        let list = threads.get(event.threadKey);
        if (!list) {
            list = [];
            threads.set(event.threadKey, list);
        }
        list.push(event);
        if (event.ts < minTs) minTs = event.ts;
        if (event.ts > maxTs) maxTs = event.ts;
    }
    for (const list of threads.values()) {
        list.sort((a, b) => (a.ts - b.ts) || (a.order - b.order));
    }

    //Tick boundaries per thread, and the thread with the most ticks
    const frameStartsByThread = new Map<string, number[]>();
    let mainFrameStarts: number[] = [];
    let mainThreadKey: string | null = null;
    for (const [threadKey, list] of threads) {
        const starts = list.filter((event) => event.ph === 'I').map((event) => event.ts);
        if (!starts.length) continue;
        frameStartsByThread.set(threadKey, starts);
        if (starts.length > mainFrameStarts.length) {
            mainFrameStarts = starts;
            mainThreadKey = threadKey;
        }
    }

    //Walk each thread with a stack
    const accumulators = new Map<string, ResourceAccumulator>();
    let unmatchedBegin = 0;
    let unmatchedEnd = 0;
    let resourceEventCount = 0;
    let frameIdCounter = 0;

    for (const [threadKey, list] of threads) {
        const ownStarts = frameStartsByThread.get(threadKey);
        const tickStarts = ownStarts ?? mainFrameStarts;
        const tickSource = ownStarts ? threadKey : mainThreadKey;
        const stack: Frame[] = [];

        const innermostResourceFrame = () => {
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].resource !== null) return stack[i];
            }
            return undefined;
        };

        const addSegment = (frame: Frame, start: number, end: number) => {
            const duration = end - start;
            if (!(duration > 0) || frame.resource === null) return;
            let acc = accumulators.get(frame.resource);
            if (!acc) {
                acc = { selfUs: 0, causes: new Map(), ticks: new Map() };
                accumulators.set(frame.resource, acc);
            }
            acc.selfUs += duration;
            acc.causes.set(frame.cause, (acc.causes.get(frame.cause) ?? 0) + duration);
            //Without any BeginFrame, every invocation is its own bucket
            const tickKey = tickStarts.length
                ? `${tickSource}:${findTickIndex(tickStarts, start)}`
                : `call:${frame.id}`;
            acc.ticks.set(tickKey, (acc.ticks.get(tickKey) ?? 0) + duration);
        };

        const closeTopFrame = (ts: number) => {
            const frame = stack.pop();
            if (!frame || frame.resource === null) return;
            addSegment(frame, frame.segStart, ts);
            const parent = innermostResourceFrame();
            if (parent) parent.segStart = ts;
        };

        let lastTs = -Infinity;
        for (const event of list) {
            lastTs = event.ts;
            if (event.ph === 'B') {
                const parsed = splitResourceEventName(event.name, known);
                const frame: Frame = {
                    id: frameIdCounter++,
                    name: event.name,
                    resource: parsed?.resource ?? null,
                    cause: parsed?.cause ?? '',
                    segStart: event.ts,
                };
                if (frame.resource !== null) {
                    resourceEventCount++;
                    //Pause the enclosing resource: nested resource time belongs to the callee
                    const parent = innermostResourceFrame();
                    if (parent) {
                        addSegment(parent, parent.segStart, event.ts);
                        parent.segStart = event.ts;
                    }
                }
                stack.push(frame);
            } else if (event.ph === 'E') {
                if (!stack.length) {
                    unmatchedEnd++;
                    continue;
                }
                //A named end that matches a deeper frame closes the frames that never ended
                if (event.name && stack[stack.length - 1].name !== event.name) {
                    let matchIndex = -1;
                    for (let i = stack.length - 2; i >= 0; i--) {
                        if (stack[i].name === event.name) {
                            matchIndex = i;
                            break;
                        }
                    }
                    if (matchIndex >= 0) {
                        while (stack.length - 1 > matchIndex) {
                            unmatchedBegin++;
                            closeTopFrame(event.ts);
                        }
                    }
                }
                closeTopFrame(event.ts);
            }
        }

        //Frames still open when the capture was saved end at the last event of their thread
        while (stack.length) {
            unmatchedBegin++;
            closeTopFrame(lastTs);
        }
    }

    if (!resourceEventCount || !accumulators.size) return null;

    const ticksFromTrace = mainFrameStarts.length > 0;
    const ticks = ticksFromTrace
        ? mainFrameStarts.length
        : Math.max(1, Math.floor(requestedFrames) || 1);
    const resources: ResourceMonitorResourceStat[] = [];
    for (const [name, acc] of accumulators) {
        const totalMs = acc.selfUs / 1000;
        let peakUs = 0;
        for (const value of acc.ticks.values()) {
            if (value > peakUs) peakUs = value;
        }
        const topCauses = [...acc.causes.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, topCausesLimit)
            .map(([cause, us]) => ({ name: cause, ms: round3(us / 1000) }));
        resources.push({
            name,
            totalMs: round3(totalMs),
            msPerTick: round3(totalMs / ticks),
            peakMs: round3(peakUs / 1000),
            topCauses,
        });
    }
    resources.sort((a, b) => (b.msPerTick - a.msPerTick) || a.name.localeCompare(b.name));

    return {
        ticks,
        ticksFromTrace,
        durationMs: Number.isFinite(maxTs - minTs) ? round3((maxTs - minTs) / 1000) : 0,
        eventCount: events.length,
        unmatchedBegin,
        unmatchedEnd,
        resources,
    };
};


/**
 * Parses a profiler trace into per-resource self time.
 * Self time is the inclusive duration minus directly nested resource events, so an export
 * called from another resource counts for the callee only. Nested scopes stay inside their resource.
 */
export const parseProfilerTrace = (input: unknown, opts: ParseTraceOptions): ParseTraceResult => {
    let rawEvents: unknown;
    if (Array.isArray(input)) {
        rawEvents = input;
    } else if (input && typeof input === 'object') {
        rawEvents = (input as Record<string, unknown>).traceEvents;
    }
    if (!Array.isArray(rawEvents)) {
        return { ok: false, reason: 'invalid_trace', eventCount: 0 };
    }

    const events = normalizeEvents(rawEvents);
    const topCausesLimit = opts.topCausesLimit ?? 3;
    const known = opts.knownResources ? new Set(opts.knownResources) : undefined;

    let trace = processEvents(events, opts.requestedFrames, known, topCausesLimit);
    //A stale resource list must not hide every resource: retry with the name heuristic
    if (!trace && known?.size) {
        trace = processEvents(events, opts.requestedFrames, undefined, topCausesLimit);
    }
    if (!trace) {
        return { ok: false, reason: 'no_resource_events', eventCount: events.length };
    }
    return { ok: true, trace };
};
