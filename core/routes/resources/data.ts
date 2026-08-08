const modulename = 'WebServer:ResourcesData';
import path from 'node:path';
import slash from 'slash';
import consoleFactory from '@lib/console';
import { SYM_SYSTEM_AUTHOR } from '@lib/symbols';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
const console = consoleFactory(modulename);

type ResourceEntry = {
    name: string;
    status: string;
    group: string;
    version: string;
    author: string;
    description: string;
};

type ResourcesDataResponse = {
    success: true;
    data: {
        generatedAt: number;
        resources: ResourceEntry[];
    };
} | {
    success: false;
    error: 'server_offline' | 'report_unavailable' | 'report_timeout';
};

const breakPath = (input: string) => slash(path.normalize(input)).split('/').filter(Boolean);

const getResourceGroup = (resourcePath: string) => {
    if (resourcePath.includes('system_resources')) return 'system_resources';
    if (!path.isAbsolute(resourcePath)) return resourcePath || 'root';

    const serverResourcesPath = breakPath(`${txConfig.server.dataPath}/resources`);
    let resourceParts = breakPath(resourcePath);
    for (let index = 0; index < serverResourcesPath.length; index++) {
        if (resourceParts[index]?.toLocaleLowerCase() !== serverResourcesPath[index].toLocaleLowerCase()) break;
        resourceParts[index] = '';
    }
    resourceParts.pop();
    resourceParts = resourceParts.filter(Boolean);
    return resourceParts.length ? resourceParts.join('/') : 'root';
};

const normalizeResources = (rawResources: unknown[]): ResourceEntry[] => rawResources
    .flatMap((raw): ResourceEntry[] => {
        if (!raw || typeof raw !== 'object') return [];
        const resource = raw as Record<string, unknown>;
        if (typeof resource.name !== 'string' || !resource.name || typeof resource.status !== 'string') return [];
        const resourcePath = typeof resource.path === 'string' ? resource.path : '';
        return [{
            name: resource.name,
            status: resource.status,
            group: getResourceGroup(resourcePath),
            version: typeof resource.version === 'string' ? resource.version.trim() : '',
            author: typeof resource.author === 'string' ? resource.author.trim() : '',
            description: typeof resource.description === 'string' ? resource.description.trim() : '',
        }];
    })
    .sort((first, second) => first.group.localeCompare(second.group) || first.name.localeCompare(second.name));

const waitForFreshReport = (requestedAt: number) => new Promise<ResourcesDataResponse>((resolve) => {
    let pollingTimer: ReturnType<typeof setInterval>;
    let timeoutTimer: ReturnType<typeof setTimeout>;
    let settled = false;
    const finish = (response: ResourcesDataResponse) => {
        if (settled) return;
        settled = true;
        clearInterval(pollingTimer);
        clearTimeout(timeoutTimer);
        resolve(response);
    };

    pollingTimer = setInterval(() => {
        const report = txCore.fxResources.resourceReport;
        if (!report || report.ts.getTime() < requestedAt || !Array.isArray(report.resources)) return;
        finish({
            success: true,
            data: {
                generatedAt: report.ts.getTime(),
                resources: normalizeResources(report.resources),
            },
        });
    }, 50);
    timeoutTimer = setTimeout(() => finish({ success: false, error: 'report_timeout' }), 2_000);
});

/**
 * Returns a fresh, path-sanitized resource report for the React resources page.
 */
export default async function ResourcesData(ctx: AuthedCtx) {
    const sendTyped = (response: ResourcesDataResponse) => ctx.send(response);
    if (!txCore.fxRunner.child?.isAlive) {
        return sendTyped({ success: false, error: 'server_offline' });
    }

    const requestedAt = Date.now();
    const commandSent = txCore.fxRunner.sendCommand('txaReportResources', [], SYM_SYSTEM_AUTHOR);
    if (!commandSent) {
        console.warn('Unable to request a fresh FXServer resource report.');
        return sendTyped({ success: false, error: 'report_unavailable' });
    }
    return sendTyped(await waitForFreshReport(requestedAt));
}
