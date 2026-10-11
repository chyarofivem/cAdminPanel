/**
 * Contracts for the Resources page: the resource list, start order, GitHub release checks,
 * updates, backups and rollbacks. Produced by core/routes/resources/*, consumed by
 * panel/src/pages/Resources/*.
 */

export type ResourceReportError = 'server_offline' | 'report_unavailable' | 'report_timeout';

export type ResourceDependency = {
    name: string;
    /** No resource with this name exists on the server. */
    missing: boolean;
};

/**
 * Why a release check produced no comparable result.
 * - no_release: the repository has no published release (or does not exist).
 * - rate_limited: GitHub refused the request (60 unauthenticated requests per hour per IP).
 * - network: the request failed or timed out.
 * - invalid_response: GitHub answered with something unexpected.
 * - unknown_version: the local version or the release tag is not a comparable version.
 */
export type ResourceUpdateCheckError = 'no_release' | 'rate_limited' | 'network' | 'invalid_response' | 'unknown_version';

export type ResourceUpdateStatus = {
    checkedAt: number;
    /** The local manifest `version`, empty when unset. */
    current: string;
    /** The release tag without a leading `v`. */
    latest?: string;
    hasUpdate: boolean;
    releaseUrl?: string;
    publishedAt?: string;
    error?: ResourceUpdateCheckError;
};

export type ResourceBackupInfo = {
    /** `<timestamp ms>_<version>`; the only backup reference the client sends back. */
    id: string;
    version: string;
    createdAt: number;
};

export type ResourceInfo = {
    name: string;
    status: string;
    group: string;
    version: string;
    author: string;
    description: string;
    dependencies: ResourceDependency[];
    /** Resources that list this one as a dependency. */
    dependents: string[];
    /** The raw manifest `repository` value, empty when unset. */
    repository: string;
    /** A safe http(s) link for `repository`, or null. */
    repositoryUrl: string | null;
    /** `owner/repo` when `repository` is a GitHub URL. */
    githubRepo: string | null;
    /** The folder is inside the server data folder and is not a system resource or the monitor. */
    canUpdate: boolean;
    update: ResourceUpdateStatus | null;
    backups: ResourceBackupInfo[];
    /** Files were replaced while the resource was running and it has not restarted since. */
    pendingRestart: boolean;
};

export type ResourceBootEntry = {
    position: number;
    resource: string;
    /** Milliseconds, -1 when unknown. */
    duration: number;
    tsBooted: number;
};

export type ResourcesDataResp = {
    success: true;
    data: {
        generatedAt: number;
        resources: ResourceInfo[];
        /** Null when the server has not booted yet. */
        bootOrder: ResourceBootEntry[] | null;
    };
} | {
    success: false;
    error: ResourceReportError;
};

export type ResourceUpdatesCheckResp = {
    success: true;
    checkedAt: number;
    /** Keyed by resource name; only resources with a GitHub repository are present. */
    results: Record<string, ResourceUpdateStatus>;
} | {
    success: false;
    error: 'forbidden' | 'report_unavailable';
};

export type ResourceUpdateFailure =
    | 'forbidden'
    | 'invalid_request'
    | 'busy'
    | 'server_offline'
    | 'report_unavailable'
    | 'resource_not_found'
    | 'not_updatable'
    | 'check_required'
    | 'no_asset'
    | 'download_failed'
    | 'too_large'
    | 'invalid_archive'
    | 'manifest_not_found'
    | 'path_rejected'
    | 'backup_failed'
    | 'backup_not_found'
    | 'swap_failed';

export type ResourceUpdateApplyResp = {
    success: true;
    resource: string;
    /** The version now on disk (release tag for updates, backup version for rollbacks). */
    version: string;
    /** The backup taken of the folder that was replaced. */
    backupId: string;
    pendingRestart: boolean;
} | {
    success: false;
    error: ResourceUpdateFailure;
};
