/*
 * Copyright (c) chyarogroup 2026
 */

export type LimitedAction = 'ban' | 'kick' | 'deleteAdmin';

type ActionWindow = {
    counts: number[];
};

export type ActionLimitResult = {
    allowed: boolean;
    retryAfterMs: number;
};

export const ACTION_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const ACTION_LIMIT_MAX_ATTEMPTS = 5;

const actionWindows = new Map<string, ActionWindow>();

/**
 * Applies a per-client-IP, per-action sliding-window limit.
 * Successful checks consume one attempt; rejected checks do not extend the window.
 */
export function checkRateLimit(
    actionType: LimitedAction,
    clientIp: string,
    now = Date.now(),
): ActionLimitResult {
    const key = `${actionType}:${clientIp.trim().toLocaleLowerCase()}`;
    const cutoff = now - ACTION_LIMIT_WINDOW_MS;
    const currentWindow = actionWindows.get(key) ?? { counts: [] };
    currentWindow.counts = currentWindow.counts.filter(timestamp => timestamp > cutoff);

    if (currentWindow.counts.length >= ACTION_LIMIT_MAX_ATTEMPTS) {
        actionWindows.set(key, currentWindow);
        return {
            allowed: false,
            retryAfterMs: Math.max(1, currentWindow.counts[0] + ACTION_LIMIT_WINDOW_MS - now),
        };
    }

    currentWindow.counts.push(now);
    actionWindows.set(key, currentWindow);
    return { allowed: true, retryAfterMs: 0 };
}

/** Exposed for isolated tests and orderly shutdowns. */
export function clearActionRateLimits() {
    actionWindows.clear();
}
