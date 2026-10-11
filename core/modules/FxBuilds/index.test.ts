import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import slash from 'slash';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

//Filled per test, read by the module at call time
const env = vi.hoisted(() => ({
    txEnv: {} as Record<string, any>,
    txHostConfig: {} as Record<string, any>,
}));
vi.mock('@core/globalData', () => env);

//The network is never reached: every request fails
vi.mock('@lib/got', () => {
    const offline = () => Promise.reject(new Error('offline in tests'));
    const got = Object.assign(
        vi.fn(() => ({ json: offline, text: offline })),
        { stream: vi.fn(() => { throw new Error('offline in tests'); }) },
    );
    return { default: got };
});

import FxBuilds from './index';

let tmpRoot: string;
let buildsRoot: string;
let hostMonitor: string;
let child: { mutex: string; isAlive: boolean } | undefined;
let sendAnnouncement: ReturnType<typeof vi.fn>;
let writeSystem: ReturnType<typeof vi.fn>;

const writeFile = (filePath: string, data = '') => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data);
};

//A fake Windows build folder, optionally with a stale monitor copy and marker
const makeBuild = (build: number, monitorVersion: string | null = '1.0.0-test') => {
    const dir = path.join(buildsRoot, String(build));
    writeFile(path.join(dir, 'FXServer.exe'), 'exe');
    writeFile(path.join(dir, 'citizen', 'system_resources', 'monitor', 'stale.txt'), 'old');
    writeFile(path.join(dir, '.cadmin-build.json'), JSON.stringify({
        build,
        installedAt: 1000,
        sizeBytes: 2048,
        monitorVersion,
        monitorStamp: 'old-stamp',
    }));
    return dir;
};

const writeState = (state: object) => {
    writeFile(path.join(buildsRoot, 'state.json'), JSON.stringify(state));
};
const readState = () => JSON.parse(fs.readFileSync(path.join(buildsRoot, 'state.json'), 'utf8'));
const installedInfo = { installedAt: 1000, sizeBytes: 2048, monitorVersion: '1.0.0-test' };

const spawnOn = (builds: FxBuilds, mutex: string, target: Awaited<ReturnType<FxBuilds['prepareForSpawn']>>) => {
    child = { mutex, isAlive: true };
    builds.handleSpawned(mutex, target);
};


beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fxbuilds-test-'));
    buildsRoot = path.join(tmpRoot, 'txData', 'fxserver-builds');
    hostMonitor = path.join(tmpRoot, 'host', 'citizen', 'system_resources', 'monitor');
    writeFile(path.join(hostMonitor, 'fxmanifest.lua'), 'fx_version "cerulean"');
    writeFile(path.join(hostMonitor, 'core', 'index.js'), '//panel');

    Object.assign(env.txEnv, {
        isWindows: true,
        fxsVersion: 12345,
        txaVersion: '1.0.0-test',
        txaPath: hostMonitor,
        fxsPath: path.join(tmpRoot, 'host'),
    });
    Object.assign(env.txHostConfig, {
        providerName: undefined,
        dataSubPath: (...parts: string[]) => path.join(tmpRoot, 'txData', ...parts),
    });

    child = undefined;
    sendAnnouncement = vi.fn(async () => undefined);
    writeSystem = vi.fn();
    vi.stubGlobal('txCore', {
        fxRunner: {
            get child() { return child; },
        },
        discordBot: { sendAnnouncement },
        logger: { admin: { writeSystem } },
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});


describe('prepareForSpawn', () => {
    it('uses the host build when no build is active', async () => {
        const builds = new FxBuilds();
        expect(await builds.prepareForSpawn()).toBeNull();
        expect(builds.childMonitorPath).toBeNull();
    });

    it('copies the panel resource into the build when its marker is outdated', async () => {
        const dir = makeBuild(13000, '0.9.0');
        writeState({ active: 13000, previous: null, pending: null, installed: { '13000': installedInfo } });
        const builds = new FxBuilds();

        const target = await builds.prepareForSpawn();
        const monitorPath = path.join(dir, 'citizen', 'system_resources', 'monitor');
        expect(target).toEqual({
            build: 13000,
            fxsPath: slash(path.normalize(dir)),
            monitorPath,
        });
        expect(builds.childMonitorPath).toBe(monitorPath);
        expect(fs.existsSync(path.join(monitorPath, 'fxmanifest.lua'))).toBe(true);
        expect(fs.existsSync(path.join(monitorPath, 'core', 'index.js'))).toBe(true);
        expect(fs.existsSync(path.join(monitorPath, 'stale.txt'))).toBe(false);
        const marker = JSON.parse(fs.readFileSync(path.join(dir, '.cadmin-build.json'), 'utf8'));
        expect(marker).toMatchObject({ build: 13000, monitorVersion: '1.0.0-test', installedAt: 1000 });

        //Up to date now: a second spawn leaves the copy alone
        writeFile(path.join(monitorPath, 'keep.txt'), 'x');
        expect(await builds.prepareForSpawn()).not.toBeNull();
        expect(fs.existsSync(path.join(monitorPath, 'keep.txt'))).toBe(true);
    });

    it('falls back to the host build when the active build is missing', async () => {
        writeState({ active: 13000, previous: null, pending: null, installed: { '13000': installedInfo } });
        const builds = new FxBuilds();
        expect(await builds.prepareForSpawn()).toBeNull();
        const data = await builds.getData();
        expect(data.lastError).toMatchObject({ type: 'fellBack', build: 13000, hostBuild: 12345 });
        expect(data.installed[0]).toMatchObject({ build: 13000, isActive: true, isAvailable: false });
    });

    it('uses the Linux layout', async () => {
        env.txEnv.isWindows = false;
        const dir = path.join(buildsRoot, '13000');
        const fxsDir = path.join(dir, 'alpine', 'opt', 'cfx-server');
        writeFile(path.join(fxsDir, 'FXServer'), 'bin');
        writeFile(path.join(fxsDir, 'ld-musl-x86_64.so.1'), 'loader');
        fs.mkdirSync(path.join(fxsDir, 'citizen'), { recursive: true });
        writeState({ active: 13000, installed: { '13000': installedInfo } });

        const target = await new FxBuilds().prepareForSpawn();
        expect(target?.fxsPath).toBe(slash(path.normalize(fxsDir)));
        expect(fs.existsSync(path.join(fxsDir, 'citizen', 'system_resources', 'monitor', 'fxmanifest.lua'))).toBe(true);
    });

    it('ignores managed builds on a provider-managed host', async () => {
        env.txHostConfig.providerName = 'Some Host';
        makeBuild(13000);
        writeState({ active: 13000, installed: { '13000': installedInfo } });
        const builds = new FxBuilds();
        expect(builds.providerManaged).toBe(true);
        expect(await builds.prepareForSpawn()).toBeNull();
        expect(await builds.activate(null)).toEqual({
            success: false,
            error: 'Your hosting provider manages FXServer builds, so they cannot be changed here.',
        });
        expect((await builds.startDownload(13001)).success).toBe(false);
        expect((await builds.deleteBuild(13000)).success).toBe(false);
        expect((await builds.rollback()).success).toBe(false);
        expect(builds.cancelDownload().success).toBe(false);
    });
});


describe('boot verification', () => {
    it('goes back to the previous build after two failed starts', async () => {
        makeBuild(12000);
        makeBuild(13000);
        writeState({
            active: 12000,
            previous: null,
            pending: null,
            installed: { '12000': installedInfo, '13000': installedInfo },
        });
        const builds = new FxBuilds();
        expect(await builds.activate(13000)).toEqual({ success: true, message: 'The game server now uses build 13000.' });
        expect(readState()).toMatchObject({ active: 13000, previous: 12000, pending: { build: 13000, failures: 0 } });

        //First start fails; the same process reported twice counts once
        spawnOn(builds, 'mtx01', await builds.prepareForSpawn());
        expect((await builds.getData()).runningBuild).toBe(13000);
        await builds.handleBootFailed();
        await builds.handleBootFailed();
        expect((await builds.getData()).pending).toEqual({ build: 13000, failures: 1 });
        expect(sendAnnouncement).not.toHaveBeenCalled();

        //Second start fails: back to 12000
        spawnOn(builds, 'mtx02', await builds.prepareForSpawn());
        await builds.handleBootFailed();
        const data = await builds.getData();
        expect(data).toMatchObject({ activeBuild: 12000, previousBuild: 13000, pending: null });
        expect(data.lastError).toMatchObject({ type: 'rolledBack', from: 13000, to: 12000 });
        expect(sendAnnouncement).toHaveBeenCalledWith({
            type: 'danger',
            title: 'Server returned to build 12000',
            description: 'Build 13000 failed to start twice, so the server went back to build 12000.',
        });
        expect(writeSystem).toHaveBeenCalledWith('MONITOR', 'Build 13000 failed to start twice, so the server went back to build 12000.');

        //The next spawn uses the reverted build
        expect((await builds.prepareForSpawn())?.build).toBe(12000);
    });

    it('names the panel build when it goes back to it', async () => {
        makeBuild(13000);
        writeState({ active: null, installed: { '13000': installedInfo } });
        const builds = new FxBuilds();
        await builds.activate(13000);
        for (const mutex of ['mtx01', 'mtx02']) {
            spawnOn(builds, mutex, await builds.prepareForSpawn());
            await builds.handleBootFailed();
        }
        expect(builds.activeBuild).toBeNull();
        expect(sendAnnouncement).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Server returned to build 12345',
            description: 'Build 13000 failed to start twice, so the server went back to build 12345.',
        }));
        expect(await builds.prepareForSpawn()).toBeNull();
    });

    it('a completed boot verifies the build', async () => {
        makeBuild(13000);
        writeState({ active: null, installed: { '13000': installedInfo } });
        const builds = new FxBuilds();
        await builds.activate(13000);
        spawnOn(builds, 'mtx01', await builds.prepareForSpawn());
        await builds.handleBootCompleted();
        await builds.handleBootFailed();
        const data = await builds.getData();
        expect(data).toMatchObject({ activeBuild: 13000, pending: null, runningBuild: 13000 });
    });

    it('does not count failures of a process started from another build', async () => {
        makeBuild(13000);
        writeState({ active: null, installed: { '13000': installedInfo } });
        const builds = new FxBuilds();
        //The host build is running when 13000 is selected for the next restart
        spawnOn(builds, 'mtx01', await builds.prepareForSpawn());
        await builds.activate(13000);
        await builds.handleBootFailed();
        await builds.handleBootFailed();
        expect((await builds.getData()).pending).toEqual({ build: 13000, failures: 0 });
        expect((await builds.getData()).runningBuild).toBe(12345);
    });
});


describe('state file and folders', () => {
    it('survives a corrupt state file and adopts marked build folders', async () => {
        makeBuild(13000);
        writeFile(path.join(buildsRoot, 'state.json'), '{ not json');
        writeFile(path.join(buildsRoot, '14000.download'), 'partial');
        writeFile(path.join(buildsRoot, '.tmp-14000', 'FXServer.exe'), 'partial');
        writeFile(path.join(buildsRoot, 'notes.txt'), 'keep');

        const builds = new FxBuilds();
        const data = await builds.getData();
        expect(data.activeBuild).toBeNull();
        expect(data.installed).toEqual([expect.objectContaining({
            build: 13000,
            installedAt: 1000,
            sizeBytes: 2048,
            isAvailable: true,
        })]);
        expect(data.sourcesError).toBe('Could not load the build lists from Cfx.re.');

        await vi.waitFor(() => {
            expect(fs.existsSync(path.join(buildsRoot, '14000.download'))).toBe(false);
            expect(fs.existsSync(path.join(buildsRoot, '.tmp-14000'))).toBe(false);
        });
        expect(fs.existsSync(path.join(buildsRoot, 'notes.txt'))).toBe(true);
    });

    it('deletes builds except the active one', async () => {
        makeBuild(12000);
        const dir13 = makeBuild(13000);
        writeState({ active: 12000, previous: 13000, installed: { '12000': installedInfo, '13000': installedInfo } });
        const builds = new FxBuilds();

        expect((await builds.deleteBuild(12000)).success).toBe(false);
        expect(await builds.deleteBuild(13000)).toEqual({ success: true, message: 'Build 13000 deleted.' });
        expect(fs.existsSync(dir13)).toBe(false);
        expect(readState()).toMatchObject({ active: 12000, previous: null });
        expect(readState().installed['13000']).toBeUndefined();
    });

    it('refuses to delete the build the server runs on', async () => {
        makeBuild(13000);
        writeState({ active: 13000, installed: { '13000': installedInfo } });
        const builds = new FxBuilds();
        spawnOn(builds, 'mtx01', await builds.prepareForSpawn());
        expect(await builds.activate(null)).toMatchObject({ success: true });
        expect(await builds.deleteBuild(13000)).toEqual({
            success: false,
            error: 'The game server is running on this build. Restart it on another build first.',
        });
    });

    it('refuses builds that are not installed or not available', async () => {
        const dir = makeBuild(13000);
        fs.rmSync(path.join(dir, 'FXServer.exe'));
        writeState({ installed: { '13000': installedInfo } });
        const builds = new FxBuilds();
        expect(await builds.activate(14000)).toEqual({ success: false, error: 'This build is not installed.' });
        expect(await builds.activate(13000)).toEqual({
            success: false,
            error: 'This build is missing files. Delete it and download it again.',
        });
        expect(await builds.rollback()).toEqual({ success: false, error: 'There is no previous build to roll back to.' });
    });

    it('refuses downloads it cannot source, without touching the network', async () => {
        makeBuild(13000);
        writeState({ installed: { '13000': installedInfo } });
        const builds = new FxBuilds();
        expect(await builds.startDownload(13000)).toEqual({ success: false, error: 'This build is already installed.' });
        expect(await builds.startDownload(5000)).toEqual({ success: false, error: 'This build is too old to run the panel resource.' });
        expect(await builds.startDownload(37175)).toEqual({
            success: false,
            error: 'No download is listed for this build. Pick one from the lists on this page.',
        });
        expect((await builds.getData()).download).toBeNull();
    });
});
