import { describe, expect, it } from 'vitest';
import {
    githubLatestReleaseApiUrl,
    isAllowedDownloadUrl,
    parseGithubRepo,
    pickReleaseDownload,
    toSafeHttpUrl,
    type GithubRelease,
} from './github';

describe('parseGithubRepo', () => {
    it.each([
        ['https://github.com/overextended/ox_lib', 'overextended', 'ox_lib'],
        ['https://github.com/overextended/ox_lib.git', 'overextended', 'ox_lib'],
        ['https://github.com/overextended/ox_lib/', 'overextended', 'ox_lib'],
        ['https://www.github.com/Owner/Repo.Name/tree/main/some/path', 'Owner', 'Repo.Name'],
        ['https://github.com/owner/repo/releases/latest', 'owner', 'repo'],
        ['http://github.com/a-b/c_d', 'a-b', 'c_d'],
        ['  https://GitHub.com/owner/repo  ', 'owner', 'repo'],
    ])('accepts %s', (input, owner, repo) => {
        expect(parseGithubRepo(input)).toEqual({ owner, repo });
    });

    it.each([
        'github.com/owner/repo',
        'git@github.com:owner/repo.git',
        'https://gitlab.com/owner/repo',
        'https://github.com/owner',
        'https://github.com/owner/repo/issues',
        'https://github.com/owner/repo.git/tree/main',
        'https://github.com.evil.com/owner/repo',
        'https://evil.com/github.com/owner/repo',
        'https://user@github.com/owner/repo',
        'https://github.com:8443/owner/repo',
        'https://github.com/owner/re%2Fpo',
        'https://github.com/owner/..',
        'https://github.com/own$er/repo',
        'javascript:alert(1)//github.com/a/b',
        '',
    ])('rejects %s', (input) => {
        expect(parseGithubRepo(input)).toBeUndefined();
    });

    it('rejects non-strings', () => {
        expect(parseGithubRepo(undefined)).toBeUndefined();
        expect(parseGithubRepo(42)).toBeUndefined();
    });

    it('builds the latest release API URL', () => {
        expect(githubLatestReleaseApiUrl({ owner: 'a', repo: 'b' }))
            .toBe('https://api.github.com/repos/a/b/releases/latest');
    });
});

describe('toSafeHttpUrl', () => {
    it('keeps http(s) links only', () => {
        expect(toSafeHttpUrl('https://example.com/res')).toBe('https://example.com/res');
        expect(toSafeHttpUrl('javascript:alert(1)')).toBeNull();
        expect(toSafeHttpUrl('ftp://example.com')).toBeNull();
        expect(toSafeHttpUrl('https://user:pass@example.com')).toBeNull();
        expect(toSafeHttpUrl('')).toBeNull();
    });
});

describe('pickReleaseDownload', () => {
    const baseRelease: GithubRelease = {
        tag_name: 'v1.3.0',
        html_url: 'https://github.com/o/r/releases/tag/v1.3.0',
        zipball_url: 'https://api.github.com/repos/o/r/zipball/v1.3.0',
        assets: [],
    };
    const asset = (name: string) => ({
        name,
        browser_download_url: `https://github.com/o/r/releases/download/v1.3.0/${name}`,
        size: 1000,
    });

    it('prefers a zip named like the resource', () => {
        const release = { ...baseRelease, assets: [asset('docs.zip'), asset('my_res-1.3.0.zip'), asset('my_res.tar.gz')] };
        expect(pickReleaseDownload(release, 'my_res')?.name).toBe('my_res-1.3.0.zip');
    });

    it('prefers the exact name over a partial match', () => {
        const release = { ...baseRelease, assets: [asset('my_res-extras.zip'), asset('MY_RES.zip')] };
        expect(pickReleaseDownload(release, 'my_res')?.name).toBe('MY_RES.zip');
    });

    it('uses the only zip asset when none is named like the resource', () => {
        const release = { ...baseRelease, assets: [asset('release.zip'), asset('checksums.txt')] };
        expect(pickReleaseDownload(release, 'my_res')?.name).toBe('release.zip');
    });

    it('falls back to the source zipball', () => {
        const release = { ...baseRelease, assets: [asset('a.zip'), asset('b.zip')] };
        expect(pickReleaseDownload(release, 'my_res')).toEqual({
            url: 'https://api.github.com/repos/o/r/zipball/v1.3.0',
            name: 'zipball',
        });
    });

    it('returns nothing without assets or zipball', () => {
        expect(pickReleaseDownload({ ...baseRelease, zipball_url: null }, 'my_res')).toBeUndefined();
    });
});

describe('isAllowedDownloadUrl', () => {
    const repo = { owner: 'Owner', repo: 'Repo' };

    it('allows release assets and zipballs of the same repository', () => {
        expect(isAllowedDownloadUrl('https://github.com/owner/repo/releases/download/v1/a.zip', repo)).toBe(true);
        expect(isAllowedDownloadUrl('https://api.github.com/repos/Owner/Repo/zipball/v1', repo)).toBe(true);
    });

    it('rejects other hosts, repositories and protocols', () => {
        expect(isAllowedDownloadUrl('https://github.com/other/repo/releases/download/v1/a.zip', repo)).toBe(false);
        expect(isAllowedDownloadUrl('http://github.com/owner/repo/releases/download/v1/a.zip', repo)).toBe(false);
        expect(isAllowedDownloadUrl('https://example.com/owner/repo/releases/download/v1/a.zip', repo)).toBe(false);
        expect(isAllowedDownloadUrl('https://api.github.com/repos/owner/repo/tarball/v1', repo)).toBe(false);
        expect(isAllowedDownloadUrl('not a url', repo)).toBe(false);
    });
});
