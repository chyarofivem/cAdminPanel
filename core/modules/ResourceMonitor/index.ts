const modulename = 'ResourceMonitor';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import throttle from 'lodash-es/throttle.js';
import consoleFactory from '@lib/console';
import { SYM_SYSTEM_AUTHOR } from '@lib/symbols';
import { txEnv } from '@core/globalData';
import { FxMonitorHealth } from '@shared/enums';
import type { UpdateConfigKeySet } from '@modules/ConfigStore/utils';
import type {
    ResourceMonitorAlert,
    ResourceMonitorDiscordDelivery,
    ResourceMonitorErrorCode,
    ResourceMonitorSample,
    ResourceMonitorServerState,
    ResourceMonitorStatus,
} from '@shared/resourceMonitorTypes';
import { parseProfilerTrace } from './parser';
import { appendAlert, buildAlertMessage, emptyAlertState, evaluateAlerts, type TriggeredAlert } from './alerts';
import {
    buildHistoryPayload,
    emptyPersistedData,
    parsePersistedData,
    pruneHistory,
    serializePersistedData,
    toHistoryEntry,
    type HistoryEntry,
} from './history';
const console = consoleFactory(modulename);


//Consts
const DATA_FILE_NAME = 'resourceMonitor.json';
const FILE_WAIT_TIMEOUT_MS = 15_000;
const FILE_POLL_INTERVAL_MS = 250;
const LATE_CLEANUP_DELAYS_MS = [30_000, 120_000];
const SAVE_THROTTLE_MS = 5_000;

/**
 * Time to wait after `profiler record` for the frames to elapse.
 * A partial capture is fine: the tick count comes from the trace itself.
 */
export const getCaptureWaitMs = (frames: number) => {
    return Math.min(30_000, Math.max(3_000, frames * 60)) + 1_500;
};

class CaptureError extends Error {
    constructor(public readonly code: ResourceMonitorErrorCode, message: string) {
        super(message);
    }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const removeFile = async (filePath: string) => {
    try {
        await fsp.rm(filePath, { force: true });
    } catch (error) {
        console.verbose.warn(`Could not delete ${filePath}: ${(error as Error).message}`);
    }
};


/**
 * Polls for the profiler file until it exists with a stable size, then parses it.
 * saveJSON runs on a detached thread, so the file can appear and grow after the command returns.
 */
const waitForTraceFile = async (filePath: string, timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs;
    let lastSize = -1;
    let lastReadError: Error | undefined;
    while (Date.now() < deadline) {
        await sleep(FILE_POLL_INTERVAL_MS);
        let size: number;
        try {
            size = (await fsp.stat(filePath)).size;
        } catch (error) {
            lastSize = -1;
            continue;
        }
        if (size <= 0 || size !== lastSize) {
            lastSize = size;
            continue;
        }
        try {
            const raw = await fsp.readFile(filePath, 'utf8');
            return JSON.parse(raw.replace(/^﻿/, '')) as unknown;
        } catch (error) {
            //Maybe still being written; wait for the size to settle again
            lastReadError = error as Error;
            lastSize = -1;
        }
    }
    if (lastReadError) {
        throw new CaptureError('invalid_trace', `The profiler file could not be read: ${lastReadError.message}`);
    }
    throw new CaptureError('file_timeout', `The profiler file did not appear within ${Math.round(timeoutMs / 1000)} seconds.`);
};


/**
 * Samples per-resource server script time through short FXServer profiler captures,
 * keeps 24h of history and raises alerts for resources that stay above a threshold.
 */
export default class ResourceMonitor {
    static readonly configKeysWatched = ['resourceMonitor.*'];

    private readonly dataFilePath = txEnv.profileSubPath('data', DATA_FILE_NAME);
    private readonly loadPromise: Promise<void>;
    private scheduleTimer: NodeJS.Timeout | null = null;
    private nextSampleAt: number | null = null;
    private samplingStartedAt: number | null = null;
    private samplingExpectedMs = 0;
    private lastSampleAt: number | null = null;
    private lastError: ResourceMonitorStatus['lastError'] = null;
    private lastSkip: ResourceMonitorStatus['lastSkip'] = null;
    private latest: ResourceMonitorSample | null = null;
    private history: HistoryEntry[] = [];
    private alerts: ResourceMonitorAlert[] = [];
    private alertState = emptyAlertState();
    private isShuttingDown = false;
    private isDirty = false;
    private readonly queueSave = throttle(
        () => { void this.saveData(); },
        SAVE_THROTTLE_MS,
        { leading: false, trailing: true },
    );

    constructor() {
        this.loadPromise = this.loadData();
        this.reschedule();
    }


    //MARK: Lifecycle
    /**
     * Reschedules when enabled or the interval changes, and resets alert streaks when the rule changes.
     */
    public handleConfigUpdate(updatedConfigs: UpdateConfigKeySet) {
        if (updatedConfigs.hasMatch(['resourceMonitor.alertThresholdMs', 'resourceMonitor.alertConsecutive'])) {
            this.alertState = emptyAlertState();
            this.markDirty();
        }
        if (updatedConfigs.hasMatch(['resourceMonitor.enabled', 'resourceMonitor.intervalMinutes'])) {
            this.reschedule();
        }
    }


    /**
     * Stops the schedule and flushes pending data to disk.
     */
    public handleShutdown() {
        this.isShuttingDown = true;
        if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
        this.scheduleTimer = null;
        this.nextSampleAt = null;
        this.queueSave.cancel();
        if (!this.isDirty) return;
        try {
            fs.writeFileSync(this.dataFilePath, JSON.stringify(this.getPersistedData()));
            this.isDirty = false;
        } catch (error) {
            console.warn(`Failed to save ${this.dataFilePath}: ${(error as Error).message}`);
        }
    }


    //MARK: Scheduling
    private reschedule() {
        if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
        this.scheduleTimer = null;
        if (this.isShuttingDown || !txConfig.resourceMonitor.enabled) {
            this.nextSampleAt = null;
            return;
        }
        const intervalMs = txConfig.resourceMonitor.intervalMinutes * 60_000;
        this.nextSampleAt = Date.now() + intervalMs;
        this.scheduleTimer = setTimeout(() => this.runScheduledSample(), intervalMs);
    }

    private runScheduledSample() {
        this.scheduleTimer = null;
        const result = this.startSample('schedule');
        if (result !== true) {
            this.lastSkip = { ts: Date.now(), code: result };
            console.verbose.debug(`Skipped the scheduled sample: ${result}`);
        }
        this.reschedule();
    }


    /**
     * The game server must be running and booted for a capture.
     */
    private getServerState(): ResourceMonitorServerState {
        if (!txCore.fxRunner.child?.isAlive) return 'offline';
        const { health, uptime } = txCore.fxMonitor.status;
        if (!uptime) return 'booting';
        if (health === FxMonitorHealth.OFFLINE) return 'offline';
        return 'online';
    }


    //MARK: Capture
    /**
     * Starts a capture in the background.
     * Returns true when started, or the reason it could not start.
     */
    public startSample(trigger: ResourceMonitorSample['trigger']): true | ResourceMonitorErrorCode {
        if (this.isShuttingDown) return 'unknown';
        if (this.samplingStartedAt !== null) return 'already_sampling';
        const serverState = this.getServerState();
        if (serverState === 'offline') return 'server_offline';
        if (serverState === 'booting') return 'server_booting';
        const dataPath = txCore.fxRunner.serverPaths?.dataPath;
        if (!dataPath) return 'not_configured';

        const frames = txConfig.resourceMonitor.frames;
        this.samplingStartedAt = Date.now();
        this.samplingExpectedMs = getCaptureWaitMs(frames) + 1_000;
        this.runCapture(trigger, frames, dataPath)
            .catch((error) => {
                console.verbose.error(`Unexpected resource sample error: ${(error as Error).message}`);
            })
            .finally(() => {
                this.samplingStartedAt = null;
            });
        return true;
    }


    /**
     * Records N ticks, saves the trace next to the server data, parses and deletes it.
     */
    private async runCapture(trigger: ResourceMonitorSample['trigger'], frames: number, dataPath: string) {
        const fileName = `cadmin-resmon-${Date.now()}.json`;
        const filePath = path.join(dataPath, fileName);
        let saveRequested = false;
        let fileRead = false;
        const sendProfilerCommand = (args: (string | number)[]) => {
            const sent = txCore.fxRunner.sendCommand('profiler', args, SYM_SYSTEM_AUTHOR);
            //NOTE: a false return can also be stdin backpressure, which still delivers the command
            if (!sent && !txCore.fxRunner.child?.isAlive) {
                throw new CaptureError('command_failed', `The server stopped before 'profiler ${args[0]}' could be sent.`);
            }
        };

        try {
            sendProfilerCommand(['record', frames]);
            await sleep(getCaptureWaitMs(frames));
            if (this.isShuttingDown) return;
            saveRequested = true;
            sendProfilerCommand(['saveJSON', fileName]);

            //Refresh the resource names while the trace is being written
            txCore.fxRunner.sendCommand('txaReportResources', [], SYM_SYSTEM_AUTHOR);

            const trace = await waitForTraceFile(filePath, FILE_WAIT_TIMEOUT_MS);
            fileRead = true;
            const parsed = parseProfilerTrace(trace, {
                requestedFrames: frames,
                knownResources: this.getKnownResourceNames(),
            });
            if (!parsed.ok) {
                throw new CaptureError(
                    parsed.reason,
                    parsed.reason === 'invalid_trace'
                        ? 'The profiler file holds no trace events.'
                        : `The capture held no resource events (${parsed.eventCount} trace events read).`,
                );
            }

            await this.loadPromise;
            await this.recordSample({
                ts: Date.now(),
                ticks: parsed.trace.ticks,
                ticksFromTrace: parsed.trace.ticksFromTrace,
                requestedFrames: frames,
                durationMs: parsed.trace.durationMs,
                trigger,
                resources: parsed.trace.resources,
            });
            if (parsed.trace.unmatchedBegin || parsed.trace.unmatchedEnd) {
                console.verbose.debug(`Trace had ${parsed.trace.unmatchedBegin} unmatched begin and ${parsed.trace.unmatchedEnd} unmatched end events.`);
            }
        } catch (error) {
            const code = error instanceof CaptureError ? error.code : 'unknown';
            const detail = (error as Error)?.message ?? String(error);
            this.lastError = { ts: Date.now(), code, detail };
            console.warn(`Resource sample failed: ${detail}`);
        } finally {
            if (saveRequested) await removeFile(filePath);
            //The detached writer may still create the file after a timeout
            if (saveRequested && !fileRead && !this.isShuttingDown) {
                for (const delay of LATE_CLEANUP_DELAYS_MS) {
                    setTimeout(() => { void removeFile(filePath); }, delay);
                }
            }
        }
    }


    /**
     * Resource names from the latest resource report.
     */
    private getKnownResourceNames() {
        const resources = txCore.fxResources.resourceReport?.resources;
        if (!Array.isArray(resources)) return undefined;
        const names = resources
            .map((resource) => resource?.name)
            .filter((name): name is string => typeof name === 'string' && name.length > 0);
        return names.length ? names : undefined;
    }


    //MARK: Samples & alerts
    private async recordSample(sample: ResourceMonitorSample) {
        this.latest = sample;
        this.lastSampleAt = sample.ts;
        this.lastError = null;
        this.history = pruneHistory([...this.history, toHistoryEntry(sample)], Date.now());

        const cfg = txConfig.resourceMonitor;
        const rule = { thresholdMs: cfg.alertThresholdMs, consecutive: cfg.alertConsecutive };
        const { state, triggered } = evaluateAlerts(this.alertState, sample.resources, rule);
        this.alertState = state;
        for (const alert of triggered) {
            await this.raiseAlert(alert, rule.thresholdMs, cfg.discordAlerts);
        }
        this.markDirty();
    }


    private async raiseAlert(alert: TriggeredAlert, thresholdMs: number, discordAlerts: boolean) {
        const copyInput = { ...alert, thresholdMs };
        console.warn(buildAlertMessage(copyInput, 'console').description);

        let discord: ResourceMonitorDiscordDelivery;
        if (!discordAlerts) {
            discord = 'off';
        } else if (!this.isDiscordConfigured) {
            discord = 'notConfigured';
        } else if (!txCore.discordBot.isClientReady) {
            discord = 'notReady';
        } else {
            const copy = buildAlertMessage(copyInput, 'discord');
            try {
                const result = await txCore.discordBot.sendAnnouncement({
                    type: 'warning',
                    title: copy.title,
                    description: copy.description,
                });
                discord = result === false ? 'notReady' : 'sent';
            } catch (error) {
                console.verbose.warn(`Discord alert failed: ${(error as Error).message}`);
                discord = 'notReady';
            }
        }

        const ts = Date.now();
        this.alerts = appendAlert(this.alerts, {
            id: `${ts.toString(36)}-${alert.resource}`,
            ts,
            resource: alert.resource,
            msPerTick: alert.msPerTick,
            thresholdMs,
            consecutive: alert.consecutive,
            discord,
        });
    }


    //MARK: Persistence
    private markDirty() {
        this.isDirty = true;
        if (!this.isShuttingDown) this.queueSave();
    }

    private getPersistedData() {
        return serializePersistedData({
            latest: this.latest,
            history: this.history,
            alerts: this.alerts,
            alertState: this.alertState,
        });
    }

    private async loadData() {
        let data = emptyPersistedData();
        try {
            const raw = await fsp.readFile(this.dataFilePath, 'utf8');
            data = parsePersistedData(JSON.parse(raw), Date.now());
        } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
                console.verbose.debug(`${DATA_FILE_NAME} not found, starting with an empty history.`);
            } else {
                console.warn(`Failed to load ${DATA_FILE_NAME}, starting with an empty history: ${(error as Error).message}`);
            }
        }

        //NOTE: recordSample() awaits this load, so nothing was recorded in the meantime
        this.latest = data.latest;
        this.lastSampleAt = data.latest?.ts ?? null;
        this.history = data.history;
        this.alerts = data.alerts;
        this.alertState = data.alertState;
    }

    private async saveData() {
        if (!this.isDirty) return;
        this.isDirty = false;
        const tmpPath = `${this.dataFilePath}.tmp`;
        try {
            await fsp.writeFile(tmpPath, JSON.stringify(this.getPersistedData()));
            await fsp.rename(tmpPath, this.dataFilePath);
        } catch (error) {
            this.isDirty = true;
            console.warn(`Failed to save ${DATA_FILE_NAME}: ${(error as Error).message}`);
        }
    }


    //MARK: Getters
    /**
     * Discord bot enabled with a warnings channel set.
     */
    public get isDiscordConfigured() {
        return Boolean(txConfig.discordBot.enabled && txConfig.discordBot.warningsChannel);
    }

    public getStatus(): ResourceMonitorStatus {
        const server = this.getServerState();
        let state: ResourceMonitorStatus['state'];
        if (this.samplingStartedAt !== null) {
            state = 'sampling';
        } else if (!txConfig.resourceMonitor.enabled) {
            state = 'disabled';
        } else if (server !== 'online') {
            state = 'serverOffline';
        } else {
            state = 'waiting';
        }
        return {
            state,
            server,
            lastSampleAt: this.lastSampleAt,
            nextSampleAt: this.nextSampleAt,
            samplingStartedAt: this.samplingStartedAt,
            samplingExpectedMs: this.samplingExpectedMs,
            lastError: this.lastError,
            lastSkip: this.lastSkip,
        };
    }

    public getLatestSample() {
        return this.latest;
    }

    public getHistoryPayload() {
        return buildHistoryPayload(pruneHistory(this.history, Date.now()));
    }

    public getAlerts() {
        return [...this.alerts];
    }
};
