const modulename = 'ResourceUpdater';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import fse from 'fs-extra';
import StreamZip from 'node-stream-zip';
import got from '@lib/got';
import consoleFactory from '@lib/console';
import { txEnv } from '@core/globalData';
import type {
    ResourceUpdateCheckError,
    ResourceUpdateFailure,
    ResourceUpdateStatus,
} from '@shared/resourceManagerTypes';
import {
    type GithubRelease,
    type GithubRepo,
    githubLatestReleaseApiUrl,
    githubReleaseSchema,
    githubRepoSlug,
    isAllowedDownloadUrl,
    parseGithubRepo,
    pickReleaseDownload,
} from './github';
import {
    FolderSwapError,
    MAX_BACKUPS_PER_RESOURCE,
    checkResourceFolder,
    createBackup,
    findManifestRoot,
    isPathInside,
    isResourceReplaceable,
    isValidBackupId,
    isValidResourceName,
    listBackups,
    pruneBackups,
    replaceFolder,
    resolveRealResourceFolder,
} from './files';
import { getResourceBackupsRoot } from './paths';
import { findReportedResource, type ReportedResource } from './report';
import {
    type CachedReleaseCheck,
    RELEASE_CHECK_TTL_MS,
    RELEASE_ERROR_TTL_MS,
    resourceUpdateState,
    toUpdateStatus,
} from './state';
import { compareResourceVersions, normalizeVersionTag } from './versions';
const console = consoleFactory(modulename);

export const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;
export const MAX_EXTRACTED_BYTES = 1024 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 50_000;
const CHECK_CONCURRENCY = 4;
const CHECK_TIMEOUT_MS = 8_000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

export class ResourceUpdateError extends Error {
    constructor(public readonly code: ResourceUpdateFailure, message?: string) {
        super(message ?? code);
        this.name = 'ResourceUpdateError';
    }
}


/**
 * MARK: Release checks
 */
export type ReleaseFetchResult = {
    ok: true;
    release: GithubRelease;
} | {
    ok: false;
    error: Exclude<ResourceUpdateCheckError, 'unknown_version'>;
    /** For rate limits: when GitHub accepts requests again (ms epoch). */
    retryAt?: number;
};
export type ReleaseFetcher = (repo: GithubRepo) => Promise<ReleaseFetchResult>;

/**
 * Asks GitHub for a repository's latest published release.
 */
export const fetchLatestRelease: ReleaseFetcher = async (repo) => {
    try {
        const resp = await got(githubLatestReleaseApiUrl(repo), {
            headers: {
                'user-agent': `cAdminPanel/${txEnv.txaVersion}`,
                accept: 'application/vnd.github+json',
                'x-github-api-version': '2022-11-28',
            },
            timeout: { request: CHECK_TIMEOUT_MS },
            retry: { limit: 0 },
            throwHttpErrors: false,
        });
        if (resp.statusCode === 404) return { ok: false, error: 'no_release' };
        if (resp.statusCode === 403 || resp.statusCode === 429) {
            const remaining = resp.headers['x-ratelimit-remaining'];
            const resetSeconds = Number(resp.headers['x-ratelimit-reset']);
            if (resp.statusCode === 429 || remaining === '0') {
                return {
                    ok: false,
                    error: 'rate_limited',
                    retryAt: Number.isFinite(resetSeconds) && resetSeconds > 0 ? resetSeconds * 1000 : undefined,
                };
            }
            return { ok: false, error: 'network' };
        }
        if (resp.statusCode !== 200) return { ok: false, error: 'network' };

        let body: unknown;
        try {
            body = JSON.parse(resp.body);
        } catch {
            return { ok: false, error: 'invalid_response' };
        }
        const parsed = githubReleaseSchema.safeParse(body);
        if (!parsed.success) return { ok: false, error: 'invalid_response' };
        if (parsed.data.draft || parsed.data.prerelease) return { ok: false, error: 'no_release' };
        return { ok: true, release: parsed.data };
    } catch (error) {
        console.verbose.warn(`Release check for ${githubRepoSlug(repo)} failed: ${(error as Error).message}`);
        return { ok: false, error: 'network' };
    }
};

/**
 * Runs `worker` over `items` with at most `limit` running at once.
 */
export const runWithConcurrency = async <T>(items: T[], limit: number, worker: (item: T) => Promise<void>) => {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const item = items[cursor++];
            await worker(item);
        }
    });
    await Promise.all(runners);
};

const buildCachedCheck = (
    result: ReleaseFetchResult,
    repo: GithubRepo,
    resourceName: string,
    now: number,
): CachedReleaseCheck => {
    const repoSlug = githubRepoSlug(repo);
    if (!result.ok) {
        const expiresAt = result.error === 'rate_limited' && result.retryAt && result.retryAt > now
            ? result.retryAt
            : now + RELEASE_ERROR_TTL_MS;
        return { repoSlug, checkedAt: now, expiresAt, error: result.error };
    }
    const download = pickReleaseDownload(result.release, resourceName);
    return {
        repoSlug,
        checkedAt: now,
        expiresAt: now + RELEASE_CHECK_TTL_MS,
        latest: normalizeVersionTag(result.release.tag_name),
        releaseUrl: result.release.html_url,
        publishedAt: result.release.published_at ?? undefined,
        download: download && isAllowedDownloadUrl(download.url, repo) ? download : undefined,
    };
};

type CheckTarget = Pick<ReportedResource, 'name' | 'version' | 'repository'>;
let checkQueue: Promise<unknown> = Promise.resolve();

/**
 * Checks GitHub releases for every resource whose `repository` is a GitHub URL.
 * Results are cached per resource for an hour; one request per repository, four at a time.
 * Calls are serialised so two administrators clicking at once share one round of requests.
 */
export const checkResourceUpdates = (
    resources: CheckTarget[],
    fetcher: ReleaseFetcher = fetchLatestRelease,
    now: () => number = Date.now,
) => {
    const run = async () => {
        const startedAt = now();
        const results: Record<string, ResourceUpdateStatus> = {};
        const pending: { resource: CheckTarget; repo: GithubRepo }[] = [];
        for (const resource of resources) {
            const repo = parseGithubRepo(resource.repository);
            if (!repo) continue;
            const cached = resourceUpdateState.getCheck(resource.name, githubRepoSlug(repo), startedAt);
            if (cached) {
                results[resource.name] = toUpdateStatus(cached, resource.version);
            } else {
                pending.push({ resource, repo });
            }
        }

        const repos = new Map<string, GithubRepo>();
        for (const { repo } of pending) repos.set(githubRepoSlug(repo).toLowerCase(), repo);
        const fetched = new Map<string, ReleaseFetchResult>();
        await runWithConcurrency([...repos.entries()], CHECK_CONCURRENCY, async ([key, repo]) => {
            if (resourceUpdateState.rateLimitedUntil > now()) {
                fetched.set(key, { ok: false, error: 'rate_limited', retryAt: resourceUpdateState.rateLimitedUntil });
                return;
            }
            const result = await fetcher(repo);
            if (!result.ok && result.error === 'rate_limited') {
                resourceUpdateState.rateLimitedUntil = result.retryAt && result.retryAt > now()
                    ? result.retryAt
                    : now() + RELEASE_ERROR_TTL_MS;
            }
            fetched.set(key, result);
        });

        const finishedAt = now();
        for (const { resource, repo } of pending) {
            const result = fetched.get(githubRepoSlug(repo).toLowerCase());
            if (!result) continue;
            const check = buildCachedCheck(result, repo, resource.name, finishedAt);
            resourceUpdateState.setCheck(resource.name, check);
            results[resource.name] = toUpdateStatus(check, resource.version);
        }
        return { checkedAt: finishedAt, results };
    };
    const task = checkQueue.then(run, run);
    checkQueue = task.catch(() => { });
    return task;
};


/**
 * MARK: Download & extract
 */
const downloadArchive = async (url: string, destFile: string) => {
    let tooLarge = false;
    const download = got.stream(url, {
        timeout: { request: DOWNLOAD_TIMEOUT_MS },
        retry: { limit: 1 },
        headers: {
            'user-agent': `cAdminPanel/${txEnv.txaVersion}`,
        },
    });
    const abortIfTooLarge = (bytes: number) => {
        if (bytes > MAX_DOWNLOAD_BYTES && !tooLarge) {
            tooLarge = true;
            download.destroy(new Error('The archive exceeds the size limit.'));
        }
    };
    download.on('response', (response) => {
        const length = Number(response.headers['content-length']);
        if (Number.isFinite(length)) abortIfTooLarge(length);
    });
    download.on('downloadProgress', (progress) => abortIfTooLarge(progress.transferred));

    //got is typed against a newer @types/node than core, which breaks stream.pipeline's
    //overloads; iterating the stream keeps backpressure without those types
    let written = 0;
    const file = await fsp.open(destFile, 'w');
    try {
        for await (const chunk of download as AsyncIterable<Buffer>) {
            written += chunk.length;
            if (written > MAX_DOWNLOAD_BYTES) {
                tooLarge = true;
                throw new Error('The archive exceeds the size limit.');
            }
            await file.write(chunk);
        }
    } catch (error) {
        download.destroy();
        throw new ResourceUpdateError(tooLarge ? 'too_large' : 'download_failed', (error as Error).message);
    } finally {
        await file.close();
    }
};

/**
 * Extracts a zip after checking its entry count and uncompressed size.
 * node-stream-zip rejects entry names that are absolute or climb out with `..`.
 */
export const extractArchive = async (zipFile: string, destDir: string) => {
    let zip: InstanceType<typeof StreamZip.async> | undefined;
    try {
        zip = new StreamZip.async({ file: zipFile });
        const entries = Object.values(await zip.entries());
        if (!entries.length) throw new ResourceUpdateError('invalid_archive', 'The archive is empty.');
        if (entries.length > MAX_ARCHIVE_ENTRIES) throw new ResourceUpdateError('too_large', 'The archive has too many files.');
        const totalBytes = entries.reduce((total, entry) => total + (entry.isFile ? entry.size : 0), 0);
        if (totalBytes > MAX_EXTRACTED_BYTES) throw new ResourceUpdateError('too_large', 'The extracted files exceed the size limit.');
        await fsp.mkdir(destDir, { recursive: true });
        await zip.extract(null, destDir);
    } catch (error) {
        if (error instanceof ResourceUpdateError) throw error;
        throw new ResourceUpdateError('invalid_archive', (error as Error).message);
    } finally {
        await zip?.close().catch(() => { });
    }
};


/**
 * MARK: Apply & rollback
 */
type ReplaceContext = {
    resource: ReportedResource;
    realFolder: string;
    backupsRoot: string;
};

const getLatestReportedResource = (resourceName: string) => {
    if (!isValidResourceName(resourceName)) throw new ResourceUpdateError('invalid_request');
    if (!txCore.fxRunner.child?.isAlive) throw new ResourceUpdateError('server_offline');
    const report = txCore.fxResources.resourceReport;
    if (!report || !Array.isArray(report.resources)) throw new ResourceUpdateError('report_unavailable');
    const resource = findReportedResource(report.resources, resourceName);
    if (!resource) throw new ResourceUpdateError('resource_not_found');
    return resource;
};

/**
 * Re-verifies the folder from the latest raw report: inside the server data folder,
 * no `..`, no system_resources, symlinks resolved, holding a manifest.
 */
const resolveReplaceContext = async (resource: ReportedResource): Promise<ReplaceContext> => {
    const dataPath = txConfig.server.dataPath;
    if (resource.name === 'monitor') throw new ResourceUpdateError('not_updatable');
    const folderCheck = checkResourceFolder(resource.path, dataPath);
    if (!folderCheck.ok || typeof dataPath !== 'string' || !isResourceReplaceable(resource, dataPath)) {
        throw new ResourceUpdateError('path_rejected', folderCheck.ok ? 'no data path' : folderCheck.reason);
    }
    const realFolder = await resolveRealResourceFolder(folderCheck.folder, dataPath);
    if (!realFolder) throw new ResourceUpdateError('path_rejected', 'The resource folder failed verification.');
    const backupsRoot = getResourceBackupsRoot();
    if (isPathInside(realFolder, backupsRoot)) {
        throw new ResourceUpdateError('path_rejected', 'The backup folder is inside the resource folder.');
    }
    return { resource, realFolder, backupsRoot };
};

/**
 * Backs the live folder up, swaps in `source`, then prunes old backups.
 */
const backupAndReplace = async ({ resource, realFolder, backupsRoot }: ReplaceContext, source: string) => {
    let backupId: string;
    try {
        backupId = await createBackup(backupsRoot, resource.name, realFolder, resource.version);
    } catch (error) {
        throw new ResourceUpdateError('backup_failed', (error as Error).message);
    }

    try {
        const swap = await replaceFolder(realFolder, source);
        if (swap.leftoverPath) {
            console.warn(`Could not delete the previous files of ${resource.name} at ${swap.leftoverPath}.`);
        }
    } catch (error) {
        if (error instanceof FolderSwapError && !error.restored) {
            console.error(`Resource ${resource.name} was not restored; its backup is ${backupId}. ${error.message}`);
        }
        throw new ResourceUpdateError('swap_failed', (error as Error).message);
    }

    try {
        await pruneBackups(backupsRoot, resource.name, MAX_BACKUPS_PER_RESOURCE);
    } catch (error) {
        console.warn(`Could not prune the backups of ${resource.name}: ${(error as Error).message}`);
    }

    const pendingRestart = resource.status === 'started';
    if (pendingRestart) {
        resourceUpdateState.markPendingRestart(resource.name);
    } else {
        resourceUpdateState.clearPendingRestart(resource.name);
    }
    return { backupId, pendingRestart };
};

const withLock = async <T>(fn: () => Promise<T>) => {
    if (!resourceUpdateState.tryLock()) throw new ResourceUpdateError('busy');
    try {
        return await fn();
    } finally {
        resourceUpdateState.unlock();
    }
};

export type ReplaceResult = {
    resource: string;
    version: string;
    backupId: string;
    pendingRestart: boolean;
    previousVersion: string;
};

/**
 * Installs the release found by the last cached check over the resource's folder.
 */
export const applyResourceUpdate = (resourceName: string) => withLock(async (): Promise<ReplaceResult> => {
    const resource = getLatestReportedResource(resourceName);
    const repo = parseGithubRepo(resource.repository);
    if (!repo) throw new ResourceUpdateError('not_updatable');

    const check = resourceUpdateState.getCheck(resource.name, githubRepoSlug(repo));
    if (!check || check.error || !check.latest) throw new ResourceUpdateError('check_required');
    if (compareResourceVersions(resource.version, check.latest) !== 'newer') {
        throw new ResourceUpdateError('check_required');
    }
    const download = check.download;
    if (!download || !isAllowedDownloadUrl(download.url, repo)) throw new ResourceUpdateError('no_asset');
    if (download.size && download.size > MAX_DOWNLOAD_BYTES) throw new ResourceUpdateError('too_large');

    const context = await resolveReplaceContext(resource);
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cadmin-resource-update-'));
    try {
        const zipFile = path.join(tempDir, 'release.zip');
        const extractDir = path.join(tempDir, 'extracted');
        await downloadArchive(download.url, zipFile);
        await extractArchive(zipFile, extractDir);
        const manifestRoot = await findManifestRoot(extractDir, resource.name, 3);
        if (!manifestRoot.ok) throw new ResourceUpdateError('manifest_not_found', manifestRoot.reason);

        const { backupId, pendingRestart } = await backupAndReplace(context, manifestRoot.root);
        return {
            resource: resource.name,
            version: check.latest,
            backupId,
            pendingRestart,
            previousVersion: resource.version,
        };
    } finally {
        await fse.remove(tempDir).catch(() => { });
    }
});

/**
 * Puts a listed backup back in place. The current folder is backed up first,
 * so a rollback can itself be undone.
 */
export const rollbackResource = (resourceName: string, backupId: string) => withLock(async (): Promise<ReplaceResult> => {
    if (!isValidBackupId(backupId)) throw new ResourceUpdateError('invalid_request');
    const resource = getLatestReportedResource(resourceName);
    const context = await resolveReplaceContext(resource);

    const backups = await listBackups(context.backupsRoot, resource.name);
    const backup = backups.find((entry) => entry.id === backupId);
    if (!backup) throw new ResourceUpdateError('backup_not_found');
    const resourceBackupsDir = path.join(context.backupsRoot, resource.name);
    const backupFolder = path.join(resourceBackupsDir, backup.id);
    if (!isPathInside(resourceBackupsDir, backupFolder)) throw new ResourceUpdateError('backup_not_found');

    //replaceFolder copies the backup completely before anything is pruned
    const { backupId: newBackupId, pendingRestart } = await backupAndReplace(context, backupFolder);
    return {
        resource: resource.name,
        version: backup.version,
        backupId: newBackupId,
        pendingRestart,
        previousVersion: resource.version,
    };
});
