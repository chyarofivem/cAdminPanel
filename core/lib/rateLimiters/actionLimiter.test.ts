import { beforeEach, describe, expect, it } from 'vitest';
import {
    ACTION_LIMIT_WINDOW_MS,
    checkRateLimit,
    clearActionRateLimits,
} from './actionLimiter';

describe('actionLimiter', () => {
    beforeEach(clearActionRateLimits);

    it('rejects the sixth action in a window', () => {
        for (let attempt = 0; attempt < 5; attempt++) {
            expect(checkRateLimit('ban', 'Alice', 1_000).allowed).toBe(true);
        }

        expect(checkRateLimit('ban', 'Alice', 1_000)).toEqual({
            allowed: false,
            retryAfterMs: ACTION_LIMIT_WINDOW_MS,
        });
    });

    it('keeps action and client IP pools independent', () => {
        for (let attempt = 0; attempt < 5; attempt++) {
            checkRateLimit('ban', 'Alice', 1_000);
        }

        expect(checkRateLimit('kick', '192.0.2.10', 1_000).allowed).toBe(true);
        expect(checkRateLimit('ban', '192.0.2.11', 1_000).allowed).toBe(true);
    });

    it('allows actions after timestamps expire', () => {
        for (let attempt = 0; attempt < 5; attempt++) {
            checkRateLimit('deleteAdmin', 'Alice', 1_000);
        }

        expect(checkRateLimit('deleteAdmin', 'Alice', 1_000 + ACTION_LIMIT_WINDOW_MS).allowed).toBe(true);
    });
});
