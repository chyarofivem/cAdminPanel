const modulename = 'WebServer:ResourcesData';
import path from 'node:path';
import slash from 'slash';
import consoleFactory from '@lib/console';
import { SYM_SYSTEM_AUTHOR } from '@lib/symbols';
import { githubRepoSlug, githubRepoUrl, parseGithubRepo, toSafeHttpUrl } from '@lib/resources/github';
import { isResourceReplaceable, listAllBackups } from '@lib/resources/files';
import { getResourceBackupsRoot } from '@lib/resources/paths';
import { normalizeReportedResources } from '@lib/resources/report';
import { resourceUpdateState, toUpdateStatus } from '@lib/resources/state';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type {
    ResourceBackupInfo,
    ResourceBootEntry,
    ResourceInfo,
    ResourcesDataResp,
} from '@shared/resourceManagerTypes';
const console = consoleFactory(modulename);

type RawReport = {
    ts: Date;
    resources: unknown[];
};

type BootLogEntry = {
    resource: string;
    duration: number;
    tsBooted: number;
};

const breakPath = (input: string) => slash(path.normalize(input)).split('/').filter(Boolean);

const getResourceGroup = (resourcePath: string) => {
    if (resourcePath.includes('system_resources')) return 'system_resources';
    if (!path.isAbsolute(resourcePath)) return resourcePath || 'root';

    const serverResourcesPath = breakPath(`${txConfig.server.dataPath}/resources`);
    const resourceParts = breakPath(resourcePath);
    const insideResources = serverResourcesPath.every((part, index) => {
        return resourceParts[index]?.toLocaleLowerCase() === part.toLocaleLowerCase();
    });
    if (!insideResources) {
        //Never expose an absolute path: name only the folder that holds the resource
        return resourceParts.length > 1 ? resourceParts[resourceParts.length - 2] : 'root';
    }
    const groupParts = resourceParts.slice(serverResourcesPath.length, -1);
    return groupParts.length ? groupParts.join('/') : 'root';
};

/**
 * The boot log also records starts after boot (restarts), so the first start of each
 * resource is its position in the boot order.
 */
const buildBootOrder = (bootLog: BootLogEntry[] | null | undefined): ResourceBootEntry[] | null => {
    if (!Array.isArray(bootLog)) return null;
    const seen = new Set<string>();
    const order: ResourceBootEntry[] = [];
    for (const entry of bootLog) {
        if (!entry || typeof entry.resource !== 'string' || seen.has(entry.resource)) continue;
        seen.add(entry.resource);
        order.push({
            position: order.length + 1,
            resource: entry.resource,
            duration: Number.isFinite(entry.duration) && entry.duration >= 0 ? Math.round(entry.duration) : -1,
            tsBooted: entry.tsBooted,
        });
    }
    return order;
};

/**
 * Builds the client-facing list: dependency edges both ways, update eligibility, cached
 * release checks and backups. Raw absolute paths never leave this function.
 */
const buildResources = async (rawResources: unknown[], bootLog: BootLogEntry[] | null | undefined) => {
    const reported = normalizeReportedResources(rawResources);
    const byName = new Map(reported.map((resource) => [resource.name, resource.name]));
    const byLowerName = new Map(reported.map((resource) => [resource.name.toLowerCase(), resource.name]));
    const resolveName = (dependency: string) => byName.get(dependency) ?? byLowerName.get(dependency.toLowerCase());

    const dependents = new Map<string, Set<string>>();
    for (const resource of reported) {
        for (const dependency of resource.dependencies) {
            const target = resolveName(dependency);
            if (!target || target === resource.name) continue;
            const existing = dependents.get(target) ?? new Set<string>();
            existing.add(resource.name);
            dependents.set(target, existing);
        }
    }

    let backups = new Map<string, ResourceBackupInfo[]>();
    try {
        backups = await listAllBackups(getResourceBackupsRoot());
    } catch (error) {
        console.verbose.warn(`Could not list resource backups: ${(error as Error).message}`);
    }

    const dataPath = txConfig.server.dataPath;
    return reported
        .map((resource): ResourceInfo => {
            const repo = parseGithubRepo(resource.repository);
            const check = repo ? resourceUpdateState.getCheck(resource.name, githubRepoSlug(repo)) : undefined;
            return {
                name: resource.name,
                status: resource.status,
                group: getResourceGroup(resource.path),
                version: resource.version,
                author: resource.author,
                description: resource.description,
                dependencies: resource.dependencies.map((name) => ({ name, missing: !resolveName(name) })),
                dependents: [...(dependents.get(resource.name) ?? [])].sort((a, b) => a.localeCompare(b)),
                repository: resource.repository,
                repositoryUrl: repo ? githubRepoUrl(repo) : toSafeHttpUrl(resource.repository),
                githubRepo: repo ? githubRepoSlug(repo) : null,
                canUpdate: isResourceReplaceable(resource, dataPath),
                update: check ? toUpdateStatus(check, resource.version) : null,
                backups: backups.get(resource.name) ?? [],
                pendingRestart: resourceUpdateState.isPendingRestart(resource.name, resource.status, bootLog),
            };
        })
        .sort((first, second) => first.group.localeCompare(second.group) || first.name.localeCompare(second.name));
};

const buildResponse = async (report: RawReport): Promise<ResourcesDataResp> => {
    const bootLog = txCore.fxResources.latestBootLog;
    return {
        success: true,
        data: {
            generatedAt: report.ts.getTime(),
            resources: await buildResources(report.resources, bootLog),
            bootOrder: buildBootOrder(bootLog),
        },
    };
};

/**
 * Waits for a report newer than `requestedAt`, falling back to the cached one at the deadline.
 */
const waitForFreshReport = (requestedAt: number) => new Promise<RawReport | undefined>((resolve) => {
    let pollingTimer: ReturnType<typeof setInterval>;
    let timeoutTimer: ReturnType<typeof setTimeout>;
    let settled = false;
    const finish = (report: RawReport | undefined) => {
        if (settled) return;
        settled = true;
        clearInterval(pollingTimer);
        clearTimeout(timeoutTimer);
        resolve(report);
    };

    pollingTimer = setInterval(() => {
        const report = txCore.fxResources.resourceReport;
        if (!report || report.ts.getTime() < requestedAt || !Array.isArray(report.resources)) return;
        finish(report);
    }, 50);
    timeoutTimer = setTimeout(() => {
        const cachedReport = txCore.fxResources.resourceReport;
        finish(cachedReport && Array.isArray(cachedReport.resources) ? cachedReport : undefined);
    }, 8_000);
});

/**
 * Returns a fresh, path-sanitized resource report for the React resources page.
 */
export default async function ResourcesData(ctx: AuthedCtx) {
    const sendTyped = (response: ResourcesDataResp) => ctx.send(response);
    if (!txCore.fxRunner.child?.isAlive) {
        return sendTyped({ success: false, error: 'server_offline' });
    }

    const requestedAt = Date.now();
    const commandSent = txCore.fxRunner.sendCommand('txaReportResources', [], SYM_SYSTEM_AUTHOR);
    if (!commandSent) {
        console.warn('Unable to request a fresh FXServer resource report.');
        return sendTyped({ success: false, error: 'report_unavailable' });
    }
    const report = await waitForFreshReport(requestedAt);
    if (!report) return sendTyped({ success: false, error: 'report_timeout' });
    return sendTyped(await buildResponse(report));
}
