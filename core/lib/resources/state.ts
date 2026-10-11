import type { ResourceUpdateCheckError, ResourceUpdateStatus } from '@shared/resourceManagerTypes';
import type { ReleaseDownload } from './github';
import { compareResourceVersions } from './versions';

//GitHub allows 60 unauthenticated requests per hour per IP
export const RELEASE_CHECK_TTL_MS = 60 * 60 * 1000;
//Failures are retried sooner, except rate limits, which wait for GitHub's reset time
export const RELEASE_ERROR_TTL_MS = 10 * 60 * 1000;

export type CachedReleaseCheck = {
    repoSlug: string;
    checkedAt: number;
    expiresAt: number;
    /** The release tag without a leading `v`. */
    latest?: string;
    releaseUrl?: string;
    publishedAt?: string;
    /** The archive picked for this resource; absent when the release has none. */
    download?: ReleaseDownload;
    error?: Exclude<ResourceUpdateCheckError, 'unknown_version'>;
};

type BootLogEntry = {
    resource: string;
    tsBooted: number;
};


/**
 * Builds the client-facing status from a cached check and the version on disk now,
 * so an applied update reads as current without asking GitHub again.
 */
export const toUpdateStatus = (check: CachedReleaseCheck, currentVersion: string): ResourceUpdateStatus => {
    if (check.error || !check.latest) {
        return {
            checkedAt: check.checkedAt,
            current: currentVersion,
            hasUpdate: false,
            error: check.error ?? 'invalid_response',
        };
    }
    const comparison = compareResourceVersions(currentVersion, check.latest);
    return {
        checkedAt: check.checkedAt,
        current: currentVersion,
        latest: check.latest,
        hasUpdate: comparison === 'newer',
        releaseUrl: check.releaseUrl,
        publishedAt: check.publishedAt,
        error: comparison === 'unknown' ? 'unknown_version' : undefined,
    };
};


/**
 * In-memory state for resource updates. Nothing here survives a panel restart, by design:
 * release checks are cheap to redo and a restart of the panel restarts the server anyway.
 */
export class ResourceUpdateState {
    private readonly checks = new Map<string, CachedReleaseCheck>();
    private readonly pendingRestarts = new Map<string, number>();
    private locked = false;
    public rateLimitedUntil = 0;

    getCheck(resource: string, repoSlug: string, now = Date.now()) {
        const check = this.checks.get(resource);
        if (!check || check.repoSlug.toLowerCase() !== repoSlug.toLowerCase() || check.expiresAt <= now) return;
        return check;
    }

    setCheck(resource: string, check: CachedReleaseCheck) {
        this.checks.set(resource, check);
    }

    markPendingRestart(resource: string, appliedAt = Date.now()) {
        this.pendingRestarts.set(resource, appliedAt);
    }

    clearPendingRestart(resource: string) {
        this.pendingRestarts.delete(resource);
    }

    /**
     * A resource that was running when its files were replaced needs a restart to load them.
     * Any start recorded after the swap clears the flag, as does finding the resource stopped.
     */
    isPendingRestart(resource: string, status: string, bootLog: BootLogEntry[] | null | undefined) {
        const appliedAt = this.pendingRestarts.get(resource);
        if (appliedAt === undefined) return false;
        const restarted = (bootLog ?? []).some((entry) => entry.resource === resource && entry.tsBooted >= appliedAt);
        if (restarted || status === 'stopped') {
            this.pendingRestarts.delete(resource);
            return false;
        }
        return status === 'started';
    }

    /**
     * One update or rollback at a time, server-wide.
     */
    tryLock() {
        if (this.locked) return false;
        this.locked = true;
        return true;
    }

    unlock() {
        this.locked = false;
    }

    reset() {
        this.checks.clear();
        this.pendingRestarts.clear();
        this.locked = false;
        this.rateLimitedUntil = 0;
    }
}

export const resourceUpdateState = new ResourceUpdateState();
