import type { ResourceMonitorAlert } from '@shared/resourceMonitorTypes';

export const ALERT_LOG_LIMIT = 50;

export type AlertRule = {
    thresholdMs: number;
    consecutive: number;
};

//Consecutive samples at or above the threshold, and the resources already alerted in that run
export type AlertTrackerState = {
    streaks: Record<string, number>;
    alerted: string[];
};

export type TriggeredAlert = {
    resource: string;
    msPerTick: number;
    consecutive: number;
};

export const emptyAlertState = (): AlertTrackerState => ({ streaks: {}, alerted: [] });


/**
 * Counts consecutive samples with msPerTick >= threshold for every resource.
 * A resource alerts once its streak reaches `consecutive`, and not again until it drops below
 * the threshold. A resource missing from a sample counts as below the threshold.
 * Returns a new state; the input is not mutated.
 */
export const evaluateAlerts = (
    prevState: AlertTrackerState,
    resources: { name: string; msPerTick: number }[],
    rule: AlertRule,
) => {
    const values = new Map<string, number>();
    for (const resource of resources) {
        if (typeof resource?.name !== 'string' || !Number.isFinite(resource.msPerTick)) continue;
        values.set(resource.name, resource.msPerTick);
    }

    const streaks: Record<string, number> = {};
    const alerted = new Set(prevState.alerted);
    const triggered: TriggeredAlert[] = [];
    const names = new Set([...Object.keys(prevState.streaks), ...values.keys()]);
    for (const name of names) {
        const msPerTick = values.get(name) ?? 0;
        if (msPerTick >= rule.thresholdMs) {
            const streak = (prevState.streaks[name] ?? 0) + 1;
            streaks[name] = streak;
            if (streak >= rule.consecutive && !alerted.has(name)) {
                alerted.add(name);
                triggered.push({ resource: name, msPerTick, consecutive: streak });
            }
        } else {
            alerted.delete(name);
        }
    }

    //Drop alerted names that no longer have a streak (eg removed from an old state)
    for (const name of alerted) {
        if (!(name in streaks)) alerted.delete(name);
    }

    return {
        state: { streaks, alerted: [...alerted] } satisfies AlertTrackerState,
        triggered,
    };
};


/**
 * Validates a persisted tracker state, returning an empty one when it is unusable.
 */
export const sanitizeAlertState = (input: unknown): AlertTrackerState => {
    if (!input || typeof input !== 'object') return emptyAlertState();
    const raw = input as Record<string, unknown>;
    const streaks: Record<string, number> = {};
    if (raw.streaks && typeof raw.streaks === 'object') {
        for (const [name, value] of Object.entries(raw.streaks as Record<string, unknown>)) {
            if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
                streaks[name] = value;
            }
        }
    }
    const alerted = Array.isArray(raw.alerted)
        ? raw.alerted.filter((name): name is string => typeof name === 'string' && name in streaks)
        : [];
    return { streaks, alerted };
};


/**
 * Appends an alert and keeps the newest ALERT_LOG_LIMIT entries.
 */
export const appendAlert = (list: ResourceMonitorAlert[], alert: ResourceMonitorAlert, limit = ALERT_LOG_LIMIT) => {
    const next = [...list, alert];
    return next.length > limit ? next.slice(next.length - limit) : next;
};


/**
 * Formats milliseconds for alert copy: one decimal for values, up to two for the threshold.
 */
export const formatAlertMs = (value: number, maxDecimals = 1) => {
    if (!Number.isFinite(value)) return '0';
    return Number(value.toFixed(maxDecimals)).toString();
};

const escapeDiscordMarkdown = (text: string) => text.replace(/([\\`*_~|])/g, '\\$1');


/**
 * Builds the alert copy. Discord copy escapes markdown in the resource name.
 */
export const buildAlertMessage = (
    alert: { resource: string; msPerTick: number; consecutive: number; thresholdMs: number },
    target: 'discord' | 'console',
) => {
    const name = target === 'discord' ? escapeDiscordMarkdown(alert.resource) : alert.resource;
    const value = formatAlertMs(alert.msPerTick);
    const threshold = formatAlertMs(alert.thresholdMs, 2);
    const run = alert.consecutive > 1 ? ` for ${alert.consecutive} samples in a row` : '';
    return {
        title: `Slow resource: ${name}`,
        description: `${name} used ${value} ms per server tick${run} (threshold ${threshold} ms).`,
    };
};
