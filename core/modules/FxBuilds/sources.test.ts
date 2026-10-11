import { describe, expect, it } from 'vitest';
import {
    buildArtifactUrl,
    changelogUrl,
    indexPageUrl,
    parseArtifactUrl,
    parseChangelog,
    parseIndexPage,
} from './sources';

const hashA = 'a74c2ccf0a56546dbb591b4545c643f56acebd3d';
const hashB = '0105063b0394b1b9d085c917a8dc9c9abf0a620f';
const hashC = '6efb47dff473c0e2a12fb50b08d74c0eb24a50d5';
const winBase = 'https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/';
const linBase = 'https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/';


describe('urls', () => {
    it('points at the platform folders', () => {
        expect(indexPageUrl('windows')).toBe(winBase);
        expect(indexPageUrl('linux')).toBe(linBase);
        expect(changelogUrl('windows')).toBe('https://changelogs-live.fivem.net/api/changelog/versions/win32/server');
        expect(changelogUrl('linux')).toBe('https://changelogs-live.fivem.net/api/changelog/versions/linux/server');
        expect(buildArtifactUrl('windows', 37150, hashA)).toBe(`${winBase}37150-${hashA}/server.zip`);
        expect(buildArtifactUrl('linux', 37150, hashA)).toBe(`${linBase}37150-${hashA}/fx.tar.xz`);
    });
});


describe('parseArtifactUrl', () => {
    it('accepts the exact artifact shape', () => {
        expect(parseArtifactUrl(`${winBase}37150-${hashA}/server.zip`, 'windows')).toEqual({
            build: 37150,
            hash: hashA,
            url: `${winBase}37150-${hashA}/server.zip`,
        });
        expect(parseArtifactUrl(`${linBase}37150-${hashA}/fx.tar.xz`, 'linux')?.build).toBe(37150);
    });

    it('rejects anything else', () => {
        const bad = [
            undefined,
            null,
            37150,
            '',
            `${linBase}37150-${hashA}/fx.tar.xz`, //other platform
            `${winBase}37150-${hashA}/server.7z`,
            `${winBase}37150-${hashA.toUpperCase()}/server.zip`,
            `${winBase}37150-${hashA.slice(1)}/server.zip`,
            `${winBase}37150-${hashA}0/server.zip`,
            `${winBase}37150-${hashA}/server.zip?x=1`,
            `${winBase}../37150-${hashA}/server.zip`,
            `http://runtime.fivem.net/artifacts/fivem/build_server_windows/master/37150-${hashA}/server.zip`,
            `https://evil.example/artifacts/fivem/build_server_windows/master/37150-${hashA}/server.zip`,
            `https://runtime.fivem.net.evil.example/artifacts/fivem/build_server_windows/master/37150-${hashA}/server.zip`,
            `${winBase}12345678-${hashA}/server.zip`,
            `${winBase}0-${hashA}/server.zip`,
        ];
        for (const url of bad) {
            expect(parseArtifactUrl(url, 'windows'), String(url)).toBeNull();
        }
    });
});


describe('parseIndexPage', () => {
    //The listing redirects to the docs download page, which carries both platforms
    //as links and as JSON. Windows builds are linked as server.7z.
    const docsPage = [
        '<html><body>',
        `<a class="Button" href="${winBase}37150-${hashA}/server.7z" target="_blank">Download</a>`,
        `<a class="Button" href="${linBase}37150-${hashA}/fx.tar.xz" target="_blank">Download</a>`,
        `<script id="__NEXT_DATA__">{"builds":[`,
        `{"displayName":"37175","downloadURL":"${winBase}37175-${hashB}/server.7z"},`,
        `{"displayName":"37150","downloadURL":"${winBase}37150-${hashA}/server.7z"},`,
        `{"displayName":"35245","downloadURL":"${winBase}35245-${hashC}/server.7z"}],`,
        `"linux":[{"downloadURL":"${linBase}37175-${hashB}/fx.tar.xz"},{"downloadURL":"${linBase}35245-${hashC}/fx.tar.xz"}]}`,
        '</script>',
        //Malformed entries that must be ignored
        `<a href="${winBase}36000-${hashA.slice(2)}/server.7z">short hash</a>`,
        `<a href="${winBase}36001-${hashA.toUpperCase()}/server.7z">upper hash</a>`,
        `<a href="${winBase}36002-${hashA}/server.exe">wrong file</a>`,
        `<a href="${winBase}36003-${hashA}/server.zip.bak">suffix</a>`,
        `<a href="https://evil.example/36004-${hashA}/server.zip">other host</a>`,
        `<a href="${winBase}123456789-${hashA}/server.zip">too long</a>`,
        '</body></html>',
    ].join('\n');

    it('extracts windows builds newest first without duplicates', () => {
        const builds = parseIndexPage(docsPage, 'windows');
        expect(builds.map((b) => b.build)).toEqual([37175, 37150, 35245]);
        expect(builds[0]).toEqual({
            build: 37175,
            hash: hashB,
            url: `${winBase}37175-${hashB}/server.zip`,
        });
    });

    it('extracts linux builds', () => {
        const builds = parseIndexPage(docsPage, 'linux');
        expect(builds.map((b) => b.build)).toEqual([37175, 37150, 35245]);
        expect(builds[1].url).toBe(`${linBase}37150-${hashA}/fx.tar.xz`);
    });

    it('reads the legacy relative listing', () => {
        const legacy = [
            `<a class="panel-block" href="./6683-${hashA}/server.zip">6683</a>`,
            `<a class="panel-block" href="./7290-${hashB}/server.zip">7290</a>`,
            `<a class="panel-block" href='7000-${hashC}/server.zip'>7000</a>`,
            `<a class="panel-block" href="./7300-${hashC}/fx.tar.xz">wrong platform</a>`,
        ].join('');
        expect(parseIndexPage(legacy, 'windows').map((b) => b.build)).toEqual([7290, 7000, 6683]);
        expect(parseIndexPage(legacy, 'linux').map((b) => b.build)).toEqual([7300]);
    });

    it('keeps the newest ones up to the limit', () => {
        const many = Array.from({ length: 40 }, (_, i) => `href="./${10000 + i}-${hashA}/server.zip"`).join(' ');
        const builds = parseIndexPage(many, 'windows');
        expect(builds).toHaveLength(25);
        expect(builds[0].build).toBe(10039);
        expect(builds[24].build).toBe(10015);
        expect(parseIndexPage(many, 'windows', 3).map((b) => b.build)).toEqual([10039, 10038, 10037]);
    });

    it('returns nothing for empty or unrelated input', () => {
        expect(parseIndexPage('', 'windows')).toEqual([]);
        expect(parseIndexPage('<html>maintenance</html>', 'linux')).toEqual([]);
        expect(parseIndexPage(undefined as any, 'linux')).toEqual([]);
    });
});


describe('parseChangelog', () => {
    const winResp = {
        critical: '7290',
        recommended: '35245',
        optional: '7290',
        latest: '37175',
        critical_download: `${winBase}7290-${hashA}/server.zip`,
        recommended_download: `${winBase}35245-${hashC}/server.zip`,
        optional_download: `${winBase}7290-${hashA}/server.zip`,
        latest_download: `${winBase}37175-${hashB}/server.zip`,
        recommended_txadmin: '8.1.1',
        support_policy: { '37175': '9999-12-31T23:59:59.9999999' },
    };

    it('parses the channel builds and their downloads', () => {
        const result = parseChangelog(winResp, 'windows');
        expect(result.channels).toEqual({
            recommended: 35245,
            latest: 37175,
            optional: 7290,
            critical: 7290,
        });
        expect(result.downloads.map((d) => d.build)).toEqual([35245, 37175, 7290]);
        expect(result.downloads[0].url).toBe(`${winBase}35245-${hashC}/server.zip`);
    });

    it('drops download URLs that do not match their channel or platform', () => {
        const result = parseChangelog({
            ...winResp,
            recommended_download: `${winBase}35000-${hashC}/server.zip`, //wrong build
            latest_download: `${linBase}37175-${hashB}/fx.tar.xz`, //wrong platform
            critical_download: 'https://evil.example/server.zip',
            optional_download: 42,
        }, 'windows');
        expect(result.channels.recommended).toBe(35245);
        expect(result.downloads).toEqual([]);
    });

    it('accepts numbers and ignores bad channel values', () => {
        const result = parseChangelog({ recommended: 35245, latest: 'abc', optional: '-1', critical: null }, 'linux');
        expect(result.channels).toEqual({ recommended: 35245, latest: null, optional: null, critical: null });
    });

    it('throws when the response is unusable', () => {
        expect(() => parseChangelog(null, 'windows')).toThrow();
        expect(() => parseChangelog('nope', 'windows')).toThrow();
        expect(() => parseChangelog([], 'windows')).toThrow();
        expect(() => parseChangelog({ recommended: 'x' }, 'windows')).toThrow();
    });
});
