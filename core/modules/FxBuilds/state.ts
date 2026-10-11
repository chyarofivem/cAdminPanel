import type { FxBuildPending } from '@shared/fxBuildTypes';

/**
 * Pure state handling for the FXServer build manager.
 * Nothing in here touches the disk or the globals, so every transition is testable.
 */

//A boot that fails this many times in a row on a freshly switched build sends the server back
export const MAX_BOOT_FAILURES = 2;

//Cfx.re build numbers are 4 or 5 digits today; this leaves plenty of room
const MAX_BUILD_NUMBER = 9_999_999;


export type InstalledBuildInfo = {
    installedAt: number;
    sizeBytes: number;
    monitorVersion: string | null;
};

export type FxBuildsState = {
    /** The build the game server starts on; null = the panel's own build. */
    active: number | null;
    /** The build a rollback returns to; null = the panel's own build. */
    previous: number | null;
    /** A switched build that has not completed a boot yet. */
    pending: FxBuildPending | null;
    /** Keyed by the build number as a string. */
    installed: Record<string, InstalledBuildInfo>;
};

export type TransitionResult = {
    ok: true;
    state: FxBuildsState;
} | {
    ok: false;
    error: string;
};

export type BootFailedResult = {
    state: FxBuildsState;
    failures: number;
    /** Set when the failure limit was reached and the active build went back. */
    reverted: { from: number; to: number | null } | null;
};


/**
 * Parses a build number from untrusted input.
 * Accepts a positive safe integer, or a string of digits only. Everything else is null,
 * so the result is always safe to use in a path.
 */
export const parseBuildNumber = (value: unknown): number | null => {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value > 0 && value <= MAX_BUILD_NUMBER
            ? value
            : null;
    }
    if (typeof value === 'string' && /^[0-9]{1,7}$/.test(value)) {
        const parsed = Number(value);
        return parsed > 0 ? parsed : null;
    }
    return null;
};


export const createEmptyState = (): FxBuildsState => ({
    active: null,
    previous: null,
    pending: null,
    installed: {},
});


export const isInstalled = (state: FxBuildsState, build: number) => {
    return Object.prototype.hasOwnProperty.call(state.installed, String(build));
};


/**
 * Normalizes a parsed state file. Unknown, missing or malformed fields fall back to the
 * empty state, so a corrupt file never blocks the boot.
 */
export const parseState = (raw: unknown): FxBuildsState => {
    const state = createEmptyState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return state;
    const obj = raw as Record<string, unknown>;

    if (obj.installed && typeof obj.installed === 'object' && !Array.isArray(obj.installed)) {
        for (const [key, value] of Object.entries(obj.installed)) {
            const build = parseBuildNumber(key);
            if (build === null || !value || typeof value !== 'object') continue;
            const info = value as Record<string, unknown>;
            state.installed[String(build)] = {
                installedAt: typeof info.installedAt === 'number' && Number.isFinite(info.installedAt)
                    ? info.installedAt
                    : 0,
                sizeBytes: typeof info.sizeBytes === 'number' && Number.isFinite(info.sizeBytes) && info.sizeBytes >= 0
                    ? info.sizeBytes
                    : 0,
                monitorVersion: typeof info.monitorVersion === 'string' ? info.monitorVersion : null,
            };
        }
    }

    state.active = parseBuildNumber(obj.active);
    state.previous = parseBuildNumber(obj.previous);

    if (obj.pending && typeof obj.pending === 'object' && !Array.isArray(obj.pending)) {
        const pending = obj.pending as Record<string, unknown>;
        const build = parseBuildNumber(pending.build);
        const failures = pending.failures;
        if (
            build !== null
            && build === state.active
            && typeof failures === 'number'
            && Number.isInteger(failures)
            && failures >= 0
            && failures < MAX_BOOT_FAILURES
        ) {
            state.pending = { build, failures };
        }
    }

    return state;
};


/**
 * Makes a build the one the game server starts on.
 * The previous active build becomes the rollback target, and a managed build is verified
 * on its next boot.
 */
export const applyActivate = (state: FxBuildsState, build: number | null): TransitionResult => {
    if (build !== null && !isInstalled(state, build)) {
        return { ok: false, error: 'This build is not installed.' };
    }
    if (build === state.active) {
        return { ok: false, error: 'The game server already uses this build.' };
    }
    return {
        ok: true,
        state: {
            ...state,
            previous: state.active,
            active: build,
            pending: build === null ? null : { build, failures: 0 },
        },
    };
};


/**
 * Switches back to the previous build, which then becomes the previous one itself.
 */
export const applyRollback = (state: FxBuildsState): TransitionResult => {
    if (state.previous === state.active) {
        return { ok: false, error: 'There is no previous build to roll back to.' };
    }
    if (state.previous !== null && !isInstalled(state, state.previous)) {
        return { ok: false, error: 'The previous build is no longer installed.' };
    }
    return applyActivate(state, state.previous);
};


/**
 * A boot completed: the pending build is verified. Returns null when nothing changes.
 */
export const applyBootCompleted = (state: FxBuildsState, spawnedBuild: number | null): FxBuildsState | null => {
    if (!state.pending || spawnedBuild === null || state.pending.build !== spawnedBuild) return null;
    return { ...state, pending: null };
};


/**
 * A boot failed before completing. Only counts against the pending build, and only when
 * the failed process was started from it. Returns null when nothing changes.
 */
export const applyBootFailed = (state: FxBuildsState, spawnedBuild: number | null): BootFailedResult | null => {
    const pending = state.pending;
    if (
        !pending
        || spawnedBuild === null
        || pending.build !== spawnedBuild
        || state.active !== spawnedBuild
    ) {
        return null;
    }

    const failures = pending.failures + 1;
    if (failures < MAX_BOOT_FAILURES) {
        return {
            state: { ...state, pending: { build: spawnedBuild, failures } },
            failures,
            reverted: null,
        };
    }

    //A previous build that was deleted in the meantime cannot be started, the panel build always can
    const target = state.previous !== null && !isInstalled(state, state.previous)
        ? null
        : state.previous;
    return {
        state: {
            ...state,
            active: target,
            previous: spawnedBuild,
            pending: null,
        },
        failures,
        reverted: { from: spawnedBuild, to: target },
    };
};


export const applyInstalled = (state: FxBuildsState, build: number, info: InstalledBuildInfo): FxBuildsState => {
    return {
        ...state,
        installed: { ...state.installed, [String(build)]: info },
    };
};


/**
 * Forgets an installed build. The active build cannot be removed; a deleted previous build
 * makes the panel build the rollback target.
 */
export const applyDeleted = (state: FxBuildsState, build: number): TransitionResult => {
    if (state.active === build) {
        return { ok: false, error: 'The game server uses this build. Switch to another build before deleting it.' };
    }
    if (!isInstalled(state, build)) {
        return { ok: false, error: 'This build is not installed.' };
    }
    const installed = { ...state.installed };
    delete installed[String(build)];
    return {
        ok: true,
        state: {
            ...state,
            installed,
            previous: state.previous === build ? null : state.previous,
            pending: state.pending?.build === build ? null : state.pending,
        },
    };
};
