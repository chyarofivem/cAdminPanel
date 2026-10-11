/**
 * Normalises the raw entries of the monitor resource's `txaReportResources` report.
 * The raw path stays server-side: it is never part of a client response.
 */
export type ReportedResource = {
    name: string;
    status: string;
    version: string;
    author: string;
    description: string;
    /** Absolute path as reported by FXServer; server-side only. */
    path: string;
    /** Resource names from the `dependency`/`dependencies` keys, without `/server:...` style constraints. */
    dependencies: string[];
    repository: string;
};

const MAX_DEPENDENCIES = 100;

const toTrimmedString = (value: unknown, maxLength = 1000) => {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
};

//Lua encodes an empty table as `{}` and a list as `[]`, so accept both shapes
const toStringList = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    if (value && typeof value === 'object') {
        return Object.values(value).filter((item): item is string => typeof item === 'string');
    }
    if (typeof value === 'string') return [value];
    return [];
};

const normalizeDependencies = (value: unknown) => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of toStringList(value)) {
        const name = raw.trim();
        //Entries such as `/server:5181`, `/onesync` or `/gameBuild:2944` are runtime constraints
        if (!name || name.startsWith('/') || name.length > 200 || seen.has(name)) continue;
        seen.add(name);
        result.push(name);
        if (result.length >= MAX_DEPENDENCIES) break;
    }
    return result;
};

export const normalizeReportedResource = (raw: unknown): ReportedResource | undefined => {
    if (!raw || typeof raw !== 'object') return;
    const resource = raw as Record<string, unknown>;
    if (typeof resource.name !== 'string' || !resource.name || typeof resource.status !== 'string') return;
    return {
        name: resource.name,
        status: resource.status,
        version: toTrimmedString(resource.version, 200),
        author: toTrimmedString(resource.author),
        description: toTrimmedString(resource.description),
        path: typeof resource.path === 'string' ? resource.path : '',
        dependencies: normalizeDependencies(resource.dependencies),
        repository: toTrimmedString(resource.repository, 500),
    };
};

export const normalizeReportedResources = (rawResources: unknown): ReportedResource[] => {
    if (!Array.isArray(rawResources)) return [];
    return rawResources
        .map(normalizeReportedResource)
        .filter((resource): resource is ReportedResource => Boolean(resource));
};

/**
 * Finds a resource in the latest raw report held by FxResources.
 */
export const findReportedResource = (rawResources: unknown, name: string) => {
    if (!Array.isArray(rawResources)) return;
    for (const raw of rawResources) {
        if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).name === name) {
            return normalizeReportedResource(raw);
        }
    }
    return;
};
