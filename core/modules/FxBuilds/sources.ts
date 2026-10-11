import got from '@lib/got';
import { fxBuildChannels, type FxBuildChannel, type FxBuildPlatform } from '@shared/fxBuildTypes';
import { parseBuildNumber } from './state';

/**
 * Where FXServer builds come from.
 * Download URLs are only ever built here, from a build number and a 40 hex hash that came
 * from the Cfx.re changelog API or the artifacts listing. Nothing from the client is used.
 */

//Builds older than this cannot run the panel resource (same floor as minFxsVersion in core/globalData.ts)
export const MIN_MANAGED_BUILD = 5894;
export const RECENT_BUILDS_LIMIT = 25;

const ARTIFACTS_ROOT = 'https://runtime.fivem.net/artifacts/fivem';

const platformFolder = (platform: FxBuildPlatform) => platform === 'windows'
    ? 'build_server_windows'
    : 'build_proot_linux';

export const archiveFileName = (platform: FxBuildPlatform) => platform === 'windows'
    ? 'server.zip'
    : 'fx.tar.xz';

export const indexPageUrl = (platform: FxBuildPlatform) => {
    return `${ARTIFACTS_ROOT}/${platformFolder(platform)}/master/`;
};

export const changelogUrl = (platform: FxBuildPlatform) => {
    const osType = platform === 'windows' ? 'win32' : 'linux';
    return `https://changelogs-live.fivem.net/api/changelog/versions/${osType}/server`;
};

export const buildArtifactUrl = (platform: FxBuildPlatform, build: number, hash: string) => {
    return `${indexPageUrl(platform)}${build}-${hash}/${archiveFileName(platform)}`;
};

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');


export type ArtifactRef = {
    build: number;
    hash: string;
    url: string;
};

export type ChangelogInfo = {
    channels: Record<FxBuildChannel, number | null>;
    downloads: ArtifactRef[];
};


/**
 * Validates an artifact URL against the exact shape for the platform and rebuilds it from
 * its parts. Returns null for anything else.
 */
export const parseArtifactUrl = (url: unknown, platform: FxBuildPlatform): ArtifactRef | null => {
    if (typeof url !== 'string') return null;
    const regex = new RegExp(
        `^${escapeRegex(indexPageUrl(platform))}([0-9]{1,7})-([0-9a-f]{40})/${escapeRegex(archiveFileName(platform))}$`
    );
    const match = regex.exec(url);
    if (!match) return null;
    const build = parseBuildNumber(match[1]);
    if (build === null) return null;
    return { build, hash: match[2], url: buildArtifactUrl(platform, build, match[2]) };
};


/**
 * Extracts the builds linked from the artifacts listing, newest first, without duplicates.
 * The listing URL now redirects to the docs download page, which links absolute URLs
 * (Windows builds as `server.7z`, served as `server.zip` too); the legacy listing linked
 * relative `./<build>-<hash>/server.zip` paths. Both shapes are accepted, nothing looser.
 */
export const parseIndexPage = (
    html: string,
    platform: FxBuildPlatform,
    limit = RECENT_BUILDS_LIMIT,
): ArtifactRef[] => {
    if (typeof html !== 'string' || !html.length) return [];
    const fileNames = platform === 'windows'
        ? '(?:server\\.zip|server\\.7z)'
        : 'fx\\.tar\\.xz';
    const prefix = `(?:${escapeRegex(indexPageUrl(platform))}|["']\\./|["'])`;
    const regex = new RegExp(`${prefix}([0-9]{1,7})-([0-9a-f]{40})/${fileNames}(?=["'])`, 'g');

    const found = new Map<number, ArtifactRef>();
    for (const match of html.matchAll(regex)) {
        const build = parseBuildNumber(match[1]);
        if (build === null || found.has(build)) continue;
        found.set(build, { build, hash: match[2], url: buildArtifactUrl(platform, build, match[2]) });
    }
    return [...found.values()]
        .sort((a, b) => b.build - a.build)
        .slice(0, limit);
};


/**
 * Parses the changelog API response: the four channel build numbers (sent as strings)
 * and their direct download URLs, kept only when the URL matches the channel build.
 */
export const parseChangelog = (raw: unknown, platform: FxBuildPlatform): ChangelogInfo => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('Unexpected changelog response.');
    }
    const obj = raw as Record<string, unknown>;
    const channels = {} as Record<FxBuildChannel, number | null>;
    const downloads: ArtifactRef[] = [];
    for (const channel of fxBuildChannels) {
        const build = parseBuildNumber(obj[channel]);
        channels[channel] = build;
        const ref = parseArtifactUrl(obj[`${channel}_download`], platform);
        if (build !== null && ref && ref.build === build && !downloads.some((d) => d.build === build)) {
            downloads.push(ref);
        }
    }
    if (fxBuildChannels.every((channel) => channels[channel] === null)) {
        throw new Error('The changelog response lists no builds.');
    }
    return { channels, downloads };
};


/**
 * Network fetchers. Tests never call these.
 */
export const fetchChangelog = async (platform: FxBuildPlatform) => {
    const cacheBuster = Math.floor(Date.now() / 900_000);
    const resp = await got(`${changelogUrl(platform)}?${cacheBuster}`, {
        timeout: { request: 10_000 },
    }).json();
    return parseChangelog(resp, platform);
};

export const fetchIndexPage = async (platform: FxBuildPlatform) => {
    const html = await got(indexPageUrl(platform), {
        timeout: { request: 15_000 },
    }).text();
    const builds = parseIndexPage(html, platform);
    if (!builds.length) throw new Error('The build listing links no builds.');
    return builds;
};
