import { useSyncExternalStore } from 'react';

/**
 * Counts authenticated API requests in flight so the shell can draw the top
 * loading bar. A module-level store keeps it independent of React context, since
 * the fetch helpers are called from hooks all over the panel.
 */
let inFlight = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export async function trackRequest<T>(work: Promise<T>): Promise<T> {
    inFlight++;
    notify();
    try {
        return await work;
    } finally {
        inFlight = Math.max(0, inFlight - 1);
        notify();
    }
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useRequestsInFlight = () => useSyncExternalStore(subscribe, () => inFlight);
