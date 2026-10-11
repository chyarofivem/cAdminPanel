const modulename = 'FxBuilds';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import fse from 'fs-extra';
import slash from 'slash';
import consoleFactory from '@lib/console';
import { txEnv, txHostConfig } from '@core/globalData';
import {
    fxBuildChannels,
    type FxBuildChannel,
    type FxBuildDownloadPhase,
    type FxBuildDownloadProgress,
    type FxBuildListItem,
    type FxBuildPlatform,
    type FxBuildsData,
    type FxBuildsNotice,
    type FxInstalledBuild,
} from '@shared/fxBuildTypes';
import { MIN_MANAGED_BUILD, fetchChangelog, fetchIndexPage, type ArtifactRef } from './sources';
import {
    MAX_BOOT_FAILURES,
    applyActivate,
    applyBootCompleted,
    applyBootFailed,
    applyDeleted,
    applyInstalled,
    applyRollback,
    createEmptyState,
    isInstalled,
    parseBuildNumber,
    parseState,
    type FxBuildsState,
    type TransitionResult,
} from './state';
import { MARKER_FILE_NAME, getBuildLayout, type BuildLayout } from './layout';
import {
    DownloadCancelledError,
    JobControl,
    copyMonitor,
    downloadFileName,
    downloadToFile,
    extractArchive,
    findLayoutProblem,
    getDirSize,
    getMonitorStamp,
    isLayoutAvailableSync,
    readMarker,
    readMarkerSync,
    removeLeftovers,
    tempDirName,
    writeMarker,
    type BuildMarker,
} from './installer';
const console = consoleFactory(modulename);


//The Cfx.re lists change a few times a day at most
const SOURCES_TTL = 15 * 60_000;
const SOURCES_RETRY_TTL = 60_000;
const SOURCES_FORCED_MIN_AGE = 30_000;

const PROVIDER_MANAGED_ERROR = 'Your hosting provider manages FXServer builds, so they cannot be changed here.';


export type FxBuildSpawnTarget = {
    build: number;
    /** Same meaning as txEnv.fxsPath, for this build. */
    fxsPath: string;
    /** The build's own copy of the panel's monitor resource. */
    monitorPath: string;
};

export type FxBuildsActionResult = {
    success: true;
    message: string;
} | {
    success: false;
    error: string;
};

type SourcesSnapshot = {
    fetchedAt: number;
    channels: Record<FxBuildChannel, number | null>;
    artifacts: Map<number, ArtifactRef>;
    recent: ArtifactRef[];
    error: string | null;
};

type SpawnRecord = {
    mutex: string;
    build: number | null;
    bootFailureCounted: boolean;
};

const emptyChannels = () => Object.fromEntries(
    fxBuildChannels.map((channel) => [channel, null])
) as Record<FxBuildChannel, number | null>;

const ok = (message: string): FxBuildsActionResult => ({ success: true, message });
const fail = (error: string): FxBuildsActionResult => ({ success: false, error });
const errorMessage = (error: unknown) => (error as Error)?.message ?? 'Unknown error';


/**
 * Downloads and manages FXServer builds the game server can run on.
 * The panel's host FXServer is never replaced: only the game server child process is
 * started from a managed build, which carries a copy of the panel's monitor resource.
 */
export default class FxBuilds {
    private readonly platform: FxBuildPlatform;
    private readonly rootPath: string;
    private readonly statePath: string;
    private state: FxBuildsState;
    private saveQueue: Promise<void> = Promise.resolve();

    private downloadJob: { build: number; control: JobControl } | null = null;
    private downloadProgress: FxBuildDownloadProgress | null = null;
    private lastError: FxBuildsNotice | null = null;

    private preparedTarget: FxBuildSpawnTarget | null = null;
    private lastSpawn: SpawnRecord | null = null;

    private sourcesCache: SourcesSnapshot | null = null;
    private sourcesPromise: Promise<SourcesSnapshot> | null = null;

    constructor() {
        this.platform = txEnv.isWindows ? 'windows' : 'linux';
        this.rootPath = txHostConfig.dataSubPath('fxserver-builds');
        this.statePath = path.join(this.rootPath, 'state.json');
        this.state = this.loadStateSync();

        //No download can be running yet, so anything half-done is a leftover
        removeLeftovers(this.rootPath).then((removed) => {
            if (removed.length) {
                console.verbose.debug(`Removed ${removed.length} unfinished FXServer build download(s).`);
            }
        }).catch(() => { });

        if (this.state.active !== null && !this.providerManaged) {
            console.verbose.debug(`The game server starts on FXServer build ${this.state.active}.`);
        }
    }


    //MARK: State
    private loadStateSync() {
        let state = createEmptyState();
        let raw: string | null = null;
        try {
            raw = fs.readFileSync(this.statePath, 'utf8');
        } catch (error) {
            if ((error as any)?.code !== 'ENOENT') {
                console.warn(`Could not read the FXServer builds state: ${errorMessage(error)}`);
            }
        }
        if (raw !== null) {
            try {
                state = parseState(JSON.parse(raw));
            } catch (error) {
                console.warn('The FXServer builds state file is corrupt, the game server starts on the panel build.');
            }
        }
        return this.adoptBuildFoldersSync(state);
    }

    /**
     * Brings back build folders that carry a marker but are missing from the state,
     * so a lost or corrupt state file does not orphan downloaded builds.
     */
    private adoptBuildFoldersSync(state: FxBuildsState) {
        let names: string[];
        try {
            names = fs.readdirSync(this.rootPath);
        } catch (error) {
            return state;
        }
        for (const name of names) {
            const build = parseBuildNumber(name);
            if (build === null || String(build) !== name || isInstalled(state, build)) continue;
            const marker = readMarkerSync(path.join(this.rootPath, name, MARKER_FILE_NAME));
            if (!marker || marker.build !== build) continue;
            state = applyInstalled(state, build, {
                installedAt: marker.installedAt,
                sizeBytes: marker.sizeBytes,
                monitorVersion: marker.monitorVersion,
            });
        }
        return state;
    }

    /**
     * Writes the state file atomically. Writes are queued and never throw.
     */
    private saveState() {
        const snapshot = JSON.stringify(this.state, null, 2);
        const task = this.saveQueue.then(async () => {
            await fsp.mkdir(this.rootPath, { recursive: true });
            const tmpPath = `${this.statePath}.tmp`;
            await fsp.writeFile(tmpPath, snapshot);
            await fsp.rename(tmpPath, this.statePath);
        }).catch((error) => {
            console.error(`Failed to save the FXServer builds state: ${errorMessage(error)}`);
        });
        this.saveQueue = task;
        return task;
    }

    private buildDir(build: number) {
        return path.join(this.rootPath, String(build));
    }

    private layoutFor(build: number): BuildLayout {
        return getBuildLayout(this.buildDir(build), txEnv.isWindows);
    }

    private refuseIfProviderManaged() {
        return this.providerManaged ? fail(PROVIDER_MANAGED_ERROR) : null;
    }


    //MARK: Spawn integration
    /**
     * Called by FxRunner before every spawn. Returns null to start the game server on the
     * panel's own build exactly as before, or the paths of the active managed build.
     * Refreshes the build's monitor copy when the panel was updated since it was made.
     * A missing or broken build logs a warning and falls back to the panel build.
     */
    public async prepareForSpawn(): Promise<FxBuildSpawnTarget | null> {
        this.preparedTarget = null;
        if (this.providerManaged) return null;
        const build = this.state.active;
        if (build === null) return null;

        const layout = this.layoutFor(build);
        const problem = await findLayoutProblem(layout, txEnv.isWindows);
        if (problem) {
            return this.fallBackToHost(build, problem);
        }
        try {
            await this.ensureMonitorCopy(build, layout);
        } catch (error) {
            return this.fallBackToHost(build, `the panel resource could not be copied into it: ${errorMessage(error)}`);
        }

        this.preparedTarget = {
            build,
            fxsPath: slash(path.normalize(layout.fxsPath)),
            monitorPath: layout.monitorPath,
        };
        console.log(`Starting the game server on FXServer build ${build}.`);
        return this.preparedTarget;
    }

    private fallBackToHost(build: number, reason: string) {
        console.warn(`FXServer build ${build} is missing or broken (${reason}).`);
        console.warn(`The game server starts on the panel build ${txEnv.fxsVersion} instead. Delete build ${build} and download it again.`);
        this.lastError = { type: 'fellBack', build, hostBuild: txEnv.fxsVersion, at: Date.now() };
        return null;
    }

    /**
     * Copies the panel's monitor resource into the build when its marker does not match
     * the running panel. The marker is cleared first, so an interrupted copy is redone.
     */
    private async ensureMonitorCopy(build: number, layout: BuildLayout) {
        const [marker, stamp] = await Promise.all([
            readMarker(layout.markerPath),
            getMonitorStamp(txEnv.txaPath),
        ]);
        let hasManifest = false;
        try {
            hasManifest = (await fsp.stat(path.join(layout.monitorPath, 'fxmanifest.lua'))).isFile();
        } catch (error) { }
        if (
            hasManifest
            && marker?.monitorVersion === txEnv.txaVersion
            && marker.monitorStamp === stamp
        ) {
            return;
        }

        console.log(`Copying the panel resource ${txEnv.txaVersion} into FXServer build ${build}.`);
        const info = this.state.installed[String(build)];
        const base: BuildMarker = {
            build,
            installedAt: marker?.installedAt ?? info?.installedAt ?? Date.now(),
            sizeBytes: marker?.sizeBytes ?? info?.sizeBytes ?? 0,
            monitorVersion: null,
            monitorStamp: null,
        };
        await writeMarker(layout.markerPath, base);
        await copyMonitor(txEnv.txaPath, layout);
        await writeMarker(layout.markerPath, {
            ...base,
            monitorVersion: txEnv.txaVersion,
            monitorStamp: stamp,
        });
        if (info) {
            this.state = applyInstalled(this.state, build, { ...info, monitorVersion: txEnv.txaVersion });
            await this.saveState();
        }
    }

    /**
     * Called by FxRunner once the child process exists, with what prepareForSpawn returned.
     */
    public handleSpawned(mutex: string, target: FxBuildSpawnTarget | null) {
        this.lastSpawn = {
            mutex,
            build: target?.build ?? null,
            bootFailureCounted: false,
        };
    }

    /**
     * The monitor folder of the build the current or next child runs from, when it is a
     * managed build. Runtime files the resource reads (custom locale) go there too.
     */
    public get childMonitorPath() {
        return this.preparedTarget?.monitorPath ?? null;
    }

    /**
     * The spawn record of the current child process, if it is still the current one.
     */
    private get currentSpawn() {
        const child = txCore.fxRunner.child;
        if (!this.lastSpawn || !child || child.mutex !== this.lastSpawn.mutex) return null;
        return this.lastSpawn;
    }

    /**
     * True when the live child process was started from this managed build's folder.
     */
    private isRunningManagedBuild(build: number) {
        const spawn = this.currentSpawn;
        return spawn !== null && spawn.build === build && txCore.fxRunner.child?.isAlive === true;
    }

    /**
     * The build the running game server uses, null when it is offline.
     */
    public get runningBuild(): number | null {
        const child = txCore.fxRunner.child;
        if (!child?.isAlive) return null;
        return this.currentSpawn?.build ?? txEnv.fxsVersion;
    }


    //MARK: Boot verification
    /**
     * Called by FxMonitor when the server completed a boot: a switched build is verified.
     * The state changes synchronously; the returned promise only tracks the file write.
     */
    public handleBootCompleted(): Promise<void> {
        const spawn = this.currentSpawn;
        if (!spawn) return Promise.resolve();
        const next = applyBootCompleted(this.state, spawn.build);
        if (!next) return Promise.resolve();
        this.state = next;
        console.ok(`FXServer build ${spawn.build} started successfully.`);
        return this.saveState();
    }

    /**
     * Called by FxMonitor when the server failed before completing a boot.
     * The second failure of a freshly switched build sends the server back to the previous
     * build; the restart FxMonitor is about to do then uses it.
     * The state changes synchronously; the returned promise only tracks the file write.
     */
    public handleBootFailed(): Promise<void> {
        const spawn = this.currentSpawn;
        if (!spawn || spawn.bootFailureCounted) return Promise.resolve();
        const result = applyBootFailed(this.state, spawn.build);
        if (!result) return Promise.resolve();
        spawn.bootFailureCounted = true;
        this.state = result.state;
        const saved = this.saveState();

        if (!result.reverted) {
            console.warn(`FXServer build ${spawn.build} failed to start (${result.failures} of ${MAX_BOOT_FAILURES}).`);
            return saved;
        }

        const { from, to } = result.reverted;
        const toBuild = to ?? txEnv.fxsVersion;
        const title = `Server returned to build ${toBuild}`;
        const description = `Build ${from} failed to start twice, so the server went back to build ${toBuild}.`;
        console.warn(description);
        this.lastError = { type: 'rolledBack', from, to: toBuild, at: Date.now() };
        try {
            txCore.logger.admin.writeSystem('MONITOR', description);
        } catch (error) { }
        Promise.resolve(
            txCore.discordBot.sendAnnouncement({ type: 'danger', title, description })
        ).catch(() => { });
        return saved;
    }


    //MARK: Sources
    private async getSources(forceRefresh = false): Promise<SourcesSnapshot> {
        const cache = this.sourcesCache;
        if (cache) {
            const age = Date.now() - cache.fetchedAt;
            const maxAge = forceRefresh
                ? SOURCES_FORCED_MIN_AGE
                : cache.error ? SOURCES_RETRY_TTL : SOURCES_TTL;
            if (age < maxAge) return cache;
        }
        if (!this.sourcesPromise) {
            this.sourcesPromise = this.fetchSources().finally(() => {
                this.sourcesPromise = null;
            });
        }
        return this.sourcesPromise;
    }

    private async fetchSources(): Promise<SourcesSnapshot> {
        const [changelog, index] = await Promise.allSettled([
            fetchChangelog(this.platform),
            fetchIndexPage(this.platform),
        ]);
        const channels = emptyChannels();
        const artifacts = new Map<number, ArtifactRef>();
        let recent: ArtifactRef[] = [];
        const failures: string[] = [];

        if (changelog.status === 'fulfilled') {
            Object.assign(channels, changelog.value.channels);
            for (const ref of changelog.value.downloads) {
                artifacts.set(ref.build, ref);
            }
        } else {
            failures.push(`changelog: ${errorMessage(changelog.reason)}`);
        }
        if (index.status === 'fulfilled') {
            recent = index.value;
            for (const ref of recent) {
                if (!artifacts.has(ref.build)) artifacts.set(ref.build, ref);
            }
        } else {
            failures.push(`listing: ${errorMessage(index.reason)}`);
        }

        if (failures.length) {
            console.verbose.warn(`Could not load the FXServer build lists (${failures.join('; ')}).`);
        }
        //Both failed: keep showing what was loaded before
        const previous = this.sourcesCache;
        const snapshot: SourcesSnapshot = (failures.length === 2 && previous)
            ? { ...previous, fetchedAt: Date.now(), error: 'Could not load the build lists from Cfx.re.' }
            : {
                fetchedAt: Date.now(),
                channels,
                artifacts,
                recent,
                error: failures.length ? 'Could not load the build lists from Cfx.re.' : null,
            };
        this.sourcesCache = snapshot;
        return snapshot;
    }

    /**
     * The download for a build, only from the changelog or the listing.
     */
    private async resolveArtifact(build: number) {
        const sources = await this.getSources();
        const cached = sources.artifacts.get(build);
        if (cached) return cached;
        const refreshed = await this.getSources(true);
        return refreshed.artifacts.get(build) ?? null;
    }


    //MARK: Download
    public async startDownload(build: number): Promise<FxBuildsActionResult> {
        const refusal = this.refuseIfProviderManaged();
        if (refusal) return refusal;
        if (this.downloadJob) {
            return fail('Another build is downloading. Wait for it to finish or cancel it.');
        }
        if (build < MIN_MANAGED_BUILD) {
            return fail('This build is too old to run the panel resource.');
        }
        if (isInstalled(this.state, build)) {
            return fail('This build is already installed.');
        }
        if (this.isRunningManagedBuild(build)) {
            return fail('The game server is running on this build. Restart it on another build first.');
        }
        const artifact = await this.resolveArtifact(build);
        if (!artifact) {
            return fail('No download is listed for this build. Pick one from the lists on this page.');
        }
        //The lookup above awaited, so check again
        if (this.downloadJob) {
            return fail('Another build is downloading. Wait for it to finish or cancel it.');
        }

        const control = new JobControl();
        this.downloadJob = { build, control };
        const now = Date.now();
        this.downloadProgress = {
            build,
            phase: 'downloading',
            receivedBytes: 0,
            totalBytes: null,
            error: null,
            startedAt: now,
            updatedAt: now,
        };
        this.runDownload(build, artifact, control).catch(() => { });
        return ok(`Downloading build ${build}.`);
    }

    private setDownloadState(build: number, changes: Partial<FxBuildDownloadProgress>) {
        if (this.downloadProgress?.build !== build) return;
        this.downloadProgress = { ...this.downloadProgress, ...changes, updatedAt: Date.now() };
    }

    private async runDownload(build: number, artifact: ArtifactRef, control: JobControl) {
        const archivePath = path.join(this.rootPath, downloadFileName(build));
        const tempDir = path.join(this.rootPath, tempDirName(build));
        const finalDir = this.buildDir(build);
        const setPhase = (phase: FxBuildDownloadPhase) => this.setDownloadState(build, { phase });

        try {
            console.log(`Downloading FXServer build ${build}.`);
            await fsp.mkdir(this.rootPath, { recursive: true });
            await fse.remove(archivePath);
            await fse.remove(tempDir);
            await downloadToFile(artifact.url, archivePath, control, (receivedBytes, totalBytes) => {
                this.setDownloadState(build, { receivedBytes, totalBytes });
            });

            setPhase('extracting');
            await extractArchive(archivePath, tempDir, txEnv.isWindows, control);
            await fse.remove(archivePath);

            setPhase('installing');
            const tempLayout = getBuildLayout(tempDir, txEnv.isWindows);
            const problem = await findLayoutProblem(tempLayout, txEnv.isWindows);
            if (problem) {
                throw new Error(`The archive is not a usable FXServer build: ${problem}.`);
            }
            const monitorStamp = await getMonitorStamp(txEnv.txaPath);
            await copyMonitor(txEnv.txaPath, tempLayout);
            control.throwIfCancelled();
            const sizeBytes = await getDirSize(tempDir);
            const installedAt = Date.now();
            await writeMarker(tempLayout.markerPath, {
                build,
                installedAt,
                sizeBytes,
                monitorVersion: txEnv.txaVersion,
                monitorStamp,
            });
            control.throwIfCancelled();

            //A folder for this build that is not in the state is a leftover nothing runs from
            await fse.remove(finalDir);
            await fse.move(tempDir, finalDir);
            this.state = applyInstalled(this.state, build, {
                installedAt,
                sizeBytes,
                monitorVersion: txEnv.txaVersion,
            });
            await this.saveState();
            setPhase('done');
            console.ok(`FXServer build ${build} is installed.`);
        } catch (error) {
            await fse.remove(archivePath).catch(() => { });
            await fse.remove(tempDir).catch(() => { });
            if (error instanceof DownloadCancelledError || control.cancelled) {
                console.warn(`The download of FXServer build ${build} was cancelled.`);
                if (this.downloadProgress?.build === build) this.downloadProgress = null;
            } else {
                const message = errorMessage(error);
                console.error(`Failed to install FXServer build ${build}: ${message}`);
                this.setDownloadState(build, { phase: 'error', error: message });
            }
        } finally {
            if (this.downloadJob?.control === control) this.downloadJob = null;
        }
    }

    /**
     * Cancels the running download. Partial files are removed by the download task.
     */
    public cancelDownload(): FxBuildsActionResult {
        const refusal = this.refuseIfProviderManaged();
        if (refusal) return refusal;
        if (!this.downloadJob) return fail('No build is downloading.');
        this.downloadJob.control.cancel();
        return ok(`Cancelling the download of build ${this.downloadJob.build}.`);
    }

    /**
     * Clears a finished or failed download from the page.
     */
    public dismissDownload(): FxBuildsActionResult {
        if (this.downloadJob) return fail('A build is still downloading.');
        this.downloadProgress = null;
        return ok('Download cleared.');
    }


    //MARK: Switching
    private checkUsable(build: number | null) {
        if (build === null) return null;
        if (!isInstalled(this.state, build)) return fail('This build is not installed.');
        if (!isLayoutAvailableSync(this.layoutFor(build))) {
            return fail('This build is missing files. Delete it and download it again.');
        }
        return null;
    }

    private async commitSwitch(result: TransitionResult): Promise<FxBuildsActionResult> {
        if (!result.ok) return fail(result.error);
        this.state = result.state;
        this.lastError = null;
        await this.saveState();
        const active = this.state.active;
        return ok(active === null
            ? `The game server now uses the panel build ${txEnv.fxsVersion}.`
            : `The game server now uses build ${active}.`);
    }

    /**
     * Makes a build (null = the panel build) the one the game server starts on.
     */
    public async activate(build: number | null): Promise<FxBuildsActionResult> {
        const refusal = this.refuseIfProviderManaged();
        if (refusal) return refusal;
        const unusable = this.checkUsable(build);
        if (unusable) return unusable;
        return this.commitSwitch(applyActivate(this.state, build));
    }

    /**
     * Switches back to the previous build.
     */
    public async rollback(): Promise<FxBuildsActionResult> {
        const refusal = this.refuseIfProviderManaged();
        if (refusal) return refusal;
        const result = applyRollback(this.state);
        if (!result.ok) return fail(result.error);
        const unusable = this.checkUsable(result.state.active);
        if (unusable) return unusable;
        return this.commitSwitch(result);
    }

    /**
     * Deletes an installed build that the game server does not use.
     */
    public async deleteBuild(build: number): Promise<FxBuildsActionResult> {
        const refusal = this.refuseIfProviderManaged();
        if (refusal) return refusal;
        if (this.downloadJob?.build === build) {
            return fail('This build is downloading. Cancel the download first.');
        }
        if (this.isRunningManagedBuild(build)) {
            return fail('The game server is running on this build. Restart it on another build first.');
        }
        const result = applyDeleted(this.state, build);
        if (!result.ok) return fail(result.error);
        try {
            await fse.remove(this.buildDir(build));
        } catch (error) {
            return fail(`Could not delete the build folder: ${errorMessage(error)}`);
        }
        this.state = result.state;
        await this.saveState();
        return ok(`Build ${build} deleted.`);
    }


    //MARK: Getters
    public get providerManaged() {
        return typeof txHostConfig.providerName === 'string' && txHostConfig.providerName.length > 0;
    }

    public get activeBuild() {
        return this.state.active;
    }

    /**
     * Everything the FXServer builds page shows.
     */
    public async getData(forceRefresh = false): Promise<FxBuildsData> {
        const sources = await this.getSources(forceRefresh);
        const hostBuild = txEnv.fxsVersion;
        const state = this.state;

        const toItem = (build: number, hasSource: boolean): FxBuildListItem => ({
            build,
            tags: fxBuildChannels.filter((channel) => sources.channels[channel] === build),
            installed: isInstalled(state, build),
            isActive: state.active === build,
            isHost: build === hostBuild,
            downloadable: hasSource && build >= MIN_MANAGED_BUILD,
        });

        const channelBuilds: FxBuildListItem[] = [];
        for (const channel of fxBuildChannels) {
            const build = sources.channels[channel];
            if (build === null || channelBuilds.some((item) => item.build === build)) continue;
            channelBuilds.push(toItem(build, sources.artifacts.has(build)));
        }

        const installed: FxInstalledBuild[] = Object.entries(state.installed)
            .map(([key, info]) => {
                const build = Number(key);
                return {
                    build,
                    installedAt: info.installedAt,
                    sizeBytes: info.sizeBytes,
                    monitorVersion: info.monitorVersion,
                    isActive: state.active === build,
                    isPrevious: state.previous === build,
                    isAvailable: isLayoutAvailableSync(this.layoutFor(build)),
                };
            })
            .sort((a, b) => b.build - a.build);

        return {
            platform: this.platform,
            hostBuild,
            activeBuild: state.active,
            previousBuild: state.previous,
            pending: state.pending ? { ...state.pending } : null,
            runningBuild: this.runningBuild,
            channels: { ...sources.channels },
            channelBuilds,
            recentBuilds: sources.recent.map((ref) => toItem(ref.build, true)),
            installed,
            download: this.downloadProgress ? { ...this.downloadProgress } : null,
            providerManaged: this.providerManaged,
            providerName: txHostConfig.providerName ?? null,
            sourcesError: sources.error,
            lastError: this.lastError ? { ...this.lastError } : null,
        };
    }


    //MARK: Shutdown
    public handleShutdown() {
        this.downloadJob?.control.cancel();
    }
};
