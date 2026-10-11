import { z } from 'zod';

export type GithubRepo = {
    owner: string;
    repo: string;
};

//GitHub owner and repository names, kept strict on purpose: they end up in an API URL
const repoPartRegex = /^[A-Za-z0-9_.-]{1,100}$/;
const allowedSubPaths = ['tree', 'releases', 'blob'];

const isValidRepoPart = (value: string) => repoPartRegex.test(value) && value !== '.' && value !== '..';


/**
 * Parses a manifest `repository` value into a GitHub owner and repository.
 * Accepts https://github.com/owner/repo with or without `www.`, a `.git` suffix, a trailing
 * slash, or a /tree/..., /blob/... or /releases/... suffix. Anything else returns undefined.
 */
export const parseGithubRepo = (raw: unknown): GithubRepo | undefined => {
    if (typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 500 || !/^https?:\/\//i.test(trimmed)) return;

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return;
    }
    if (url.username || url.password || url.port) return;
    const host = url.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') return;
    if (url.pathname.includes('%')) return;

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return;
    const owner = segments[0];
    const hasGitSuffix = /\.git$/i.test(segments[1]);
    const repo = segments[1].replace(/\.git$/i, '');
    if (!isValidRepoPart(owner) || !isValidRepoPart(repo)) return;
    if (segments.length > 2) {
        if (hasGitSuffix) return;
        if (!allowedSubPaths.includes(segments[2].toLowerCase())) return;
    }
    return { owner, repo };
};

export const githubRepoSlug = ({ owner, repo }: GithubRepo) => `${owner}/${repo}`;
export const githubRepoUrl = ({ owner, repo }: GithubRepo) => `https://github.com/${owner}/${repo}`;
export const githubLatestReleaseApiUrl = ({ owner, repo }: GithubRepo) => {
    return `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
};


/**
 * Returns the value as a link only when it is a plain http(s) URL.
 */
export const toSafeHttpUrl = (raw: unknown) => {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!/^https?:\/\//i.test(trimmed) || trimmed.length > 500) return null;
    try {
        const url = new URL(trimmed);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        if (url.username || url.password) return null;
        return url.toString();
    } catch {
        return null;
    }
};


/**
 * MARK: Releases
 * Only the fields actually used are required, so an upstream schema change cannot break the check.
 */
export const githubReleaseSchema = z.object({
    tag_name: z.string().min(1).max(200),
    html_url: z.string().url(),
    published_at: z.string().nullish(),
    zipball_url: z.string().url().nullish(),
    draft: z.boolean().optional(),
    prerelease: z.boolean().optional(),
    assets: z.array(z.object({
        name: z.string(),
        browser_download_url: z.string().url(),
        size: z.number().optional(),
    })).optional(),
});
export type GithubRelease = z.infer<typeof githubReleaseSchema>;

export type ReleaseDownload = {
    url: string;
    /** The asset name, or `zipball` for the source archive. */
    name: string;
    /** Bytes, when GitHub reported it. */
    size?: number;
};


/**
 * Only GitHub hosts may serve the archive, and only for the checked repository.
 * GitHub then redirects to its own storage, which is fine.
 */
export const isAllowedDownloadUrl = (rawUrl: string, repo: GithubRepo) => {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const pathLower = url.pathname.toLowerCase();
    const owner = repo.owner.toLowerCase();
    const name = repo.repo.toLowerCase();
    if (url.hostname === 'github.com') {
        return pathLower.startsWith(`/${owner}/${name}/releases/download/`);
    } else if (url.hostname === 'api.github.com') {
        return pathLower.startsWith(`/repos/${owner}/${name}/zipball/`)
            || pathLower.startsWith(`/repos/${owner}/${name}/releases/assets/`);
    }
    return false;
};


/**
 * Picks the archive to install from a release:
 * a .zip asset whose name contains the resource name, else the only .zip asset,
 * else the release source zipball.
 */
export const pickReleaseDownload = (release: GithubRelease, resourceName: string): ReleaseDownload | undefined => {
    const zipAssets = (release.assets ?? []).filter((asset) => asset.name.toLowerCase().endsWith('.zip'));
    const nameLower = resourceName.toLowerCase();
    const exact = zipAssets.find((asset) => asset.name.toLowerCase() === `${nameLower}.zip`);
    const named = exact ?? zipAssets.find((asset) => asset.name.toLowerCase().includes(nameLower));
    const chosen = named ?? (zipAssets.length === 1 ? zipAssets[0] : undefined);
    if (chosen) {
        return { url: chosen.browser_download_url, name: chosen.name, size: chosen.size };
    }
    if (release.zipball_url) {
        return { url: release.zipball_url, name: 'zipball' };
    }
    return;
};
