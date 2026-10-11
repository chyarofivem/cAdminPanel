import { describe, expect, it } from 'vitest';
import {
    MAX_BOOT_FAILURES,
    applyActivate,
    applyBootCompleted,
    applyBootFailed,
    applyDeleted,
    applyInstalled,
    applyRollback,
    createEmptyState,
    parseBuildNumber,
    parseState,
    type FxBuildsState,
} from './state';

const info = { installedAt: 1, sizeBytes: 100, monitorVersion: '1.0.0' };
const withBuilds = (...builds: number[]) => {
    let state = createEmptyState();
    for (const build of builds) state = applyInstalled(state, build, info);
    return state;
};


describe('parseBuildNumber', () => {
    it('accepts positive integers and digit strings', () => {
        expect(parseBuildNumber(13000)).toBe(13000);
        expect(parseBuildNumber('13000')).toBe(13000);
        expect(parseBuildNumber('012')).toBe(12);
        expect(parseBuildNumber(9_999_999)).toBe(9_999_999);
    });

    it('refuses everything that is not digits only', () => {
        const bad = [
            '', ' 13000', '13000 ', '13a', '1e4', '0x10', '1.5', '-1', '+1', '../1', '..\\1', '13000/..',
            '0', '00', '99999999', 0, -1, 1.5, NaN, Infinity, 10_000_000, Number.MAX_SAFE_INTEGER + 1,
            null, undefined, {}, [], [13000], true,
        ];
        for (const value of bad) {
            expect(parseBuildNumber(value), JSON.stringify(value) ?? String(value)).toBeNull();
        }
    });
});


describe('parseState', () => {
    it('falls back to the empty state for unusable input', () => {
        for (const raw of [undefined, null, 'x', 42, [], [1, 2]]) {
            expect(parseState(raw)).toEqual(createEmptyState());
        }
    });

    it('keeps valid fields and drops the rest', () => {
        const state = parseState({
            active: 13000,
            previous: '12000',
            pending: { build: 13000, failures: 1 },
            installed: {
                '13000': { installedAt: 5, sizeBytes: 10, monitorVersion: '1.0.0' },
                '12000': { installedAt: 'x', sizeBytes: -1 },
                '../evil': info,
                '12a': info,
                '11000': null,
            },
            extra: true,
        });
        expect(state).toEqual({
            active: 13000,
            previous: 12000,
            pending: { build: 13000, failures: 1 },
            installed: {
                '13000': { installedAt: 5, sizeBytes: 10, monitorVersion: '1.0.0' },
                '12000': { installedAt: 0, sizeBytes: 0, monitorVersion: null },
            },
        });
    });

    it('drops a pending entry that does not belong to the active build', () => {
        expect(parseState({ active: 13000, pending: { build: 12000, failures: 0 } }).pending).toBeNull();
        expect(parseState({ active: null, pending: { build: 12000, failures: 0 } }).pending).toBeNull();
        expect(parseState({ active: 13000, pending: { build: 13000, failures: MAX_BOOT_FAILURES } }).pending).toBeNull();
        expect(parseState({ active: 13000, pending: { build: 13000, failures: 0.5 } }).pending).toBeNull();
        expect(parseState({ active: 'abc', previous: '../x' })).toMatchObject({ active: null, previous: null });
    });
});


describe('switching builds', () => {
    it('refuses a build that is not installed', () => {
        const result = applyActivate(createEmptyState(), 13000);
        expect(result).toEqual({ ok: false, error: 'This build is not installed.' });
    });

    it('activates a build, remembers the previous one and marks it for verification', () => {
        const result = applyActivate(withBuilds(13000), 13000);
        expect(result.ok && result.state).toMatchObject({
            active: 13000,
            previous: null,
            pending: { build: 13000, failures: 0 },
        });
    });

    it('does not verify the panel build', () => {
        const start = { ...withBuilds(13000), active: 13000 };
        const result = applyActivate(start, null);
        expect(result.ok && result.state).toMatchObject({ active: null, previous: 13000, pending: null });
    });

    it('refuses the build already in use', () => {
        expect(applyActivate(createEmptyState(), null).ok).toBe(false);
        expect(applyActivate({ ...withBuilds(13000), active: 13000 }, 13000).ok).toBe(false);
    });

    it('rolls back to the previous build and swaps them', () => {
        const start: FxBuildsState = { ...withBuilds(12000, 13000), active: 13000, previous: 12000 };
        const result = applyRollback(start);
        expect(result.ok && result.state).toMatchObject({
            active: 12000,
            previous: 13000,
            pending: { build: 12000, failures: 0 },
        });
    });

    it('rolls back to the panel build', () => {
        const start: FxBuildsState = { ...withBuilds(13000), active: 13000, previous: null };
        const result = applyRollback(start);
        expect(result.ok && result.state).toMatchObject({ active: null, previous: 13000, pending: null });
    });

    it('refuses a rollback without a previous build', () => {
        expect(applyRollback(createEmptyState()).ok).toBe(false);
        const gone: FxBuildsState = { ...withBuilds(13000), active: 13000, previous: 12000 };
        expect(applyRollback(gone)).toEqual({ ok: false, error: 'The previous build is no longer installed.' });
    });
});


describe('boot verification', () => {
    const switched = () => {
        const start: FxBuildsState = { ...withBuilds(12000, 13000), active: 12000 };
        const result = applyActivate(start, 13000);
        if (!result.ok) throw new Error('setup failed');
        return result.state;
    };

    it('clears the pending build after a completed boot', () => {
        const state = switched();
        expect(applyBootCompleted(state, 13000)?.pending).toBeNull();
    });

    it('ignores boots of other builds', () => {
        const state = switched();
        expect(applyBootCompleted(state, 12000)).toBeNull();
        expect(applyBootCompleted(state, null)).toBeNull();
        expect(applyBootFailed(state, 12000)).toBeNull();
        expect(applyBootFailed(state, null)).toBeNull();
        expect(applyBootCompleted(createEmptyState(), 13000)).toBeNull();
    });

    it('goes back to the previous build after two failed boots', () => {
        const first = applyBootFailed(switched(), 13000);
        expect(first).toMatchObject({ failures: 1, reverted: null });
        expect(first!.state).toMatchObject({ active: 13000, previous: 12000, pending: { build: 13000, failures: 1 } });

        const second = applyBootFailed(first!.state, 13000);
        expect(second).toMatchObject({ failures: 2, reverted: { from: 13000, to: 12000 } });
        expect(second!.state).toMatchObject({ active: 12000, previous: 13000, pending: null });

        //Further failures of the old build do not count against anything
        expect(applyBootFailed(second!.state, 13000)).toBeNull();
        expect(applyBootFailed(second!.state, 12000)).toBeNull();
    });

    it('a completed boot between failures verifies the build', () => {
        const first = applyBootFailed(switched(), 13000)!;
        const booted = applyBootCompleted(first.state, 13000)!;
        expect(booted.pending).toBeNull();
        expect(applyBootFailed(booted, 13000)).toBeNull();
    });

    it('goes back to the panel build when the previous build was deleted', () => {
        let state = switched();
        const deleted = applyDeleted(state, 12000);
        if (!deleted.ok) throw new Error('setup failed');
        state = deleted.state;
        expect(state.previous).toBeNull();
        state = applyBootFailed(state, 13000)!.state;
        const result = applyBootFailed(state, 13000)!;
        expect(result.reverted).toEqual({ from: 13000, to: null });
        expect(result.state.active).toBeNull();
    });
});


describe('applyDeleted', () => {
    it('refuses the active build', () => {
        const state: FxBuildsState = { ...withBuilds(13000), active: 13000 };
        expect(applyDeleted(state, 13000).ok).toBe(false);
    });

    it('refuses a build that is not installed', () => {
        expect(applyDeleted(createEmptyState(), 13000).ok).toBe(false);
    });

    it('removes other builds and resets a deleted previous build to the panel build', () => {
        const state: FxBuildsState = { ...withBuilds(12000, 13000, 14000), active: 13000, previous: 12000 };
        const result = applyDeleted(state, 12000);
        expect(result.ok && result.state).toMatchObject({ active: 13000, previous: null });
        expect(result.ok && Object.keys(result.state.installed).sort()).toEqual(['13000', '14000']);
    });
});
