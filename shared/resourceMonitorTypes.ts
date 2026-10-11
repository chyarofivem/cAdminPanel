/**
 * API contract for the live resource monitor (GET /resourceMonitor/data, POST /resourceMonitor/:action).
 * NOTE: keep this file free of imports, it is shared by core and panel.
 */

export type ResourceMonitorConfig = {
    enabled: boolean;
    intervalMinutes: number;
    frames: number;
    alertThresholdMs: number;
    alertConsecutive: number;
    discordAlerts: boolean;
};

//One script-time cause of a resource, eg the tick or event name
export type ResourceMonitorCause = {
    name: string;
    ms: number;
};

export type ResourceMonitorResourceStat = {
    name: string;
    //Self time over the whole capture
    totalMs: number;
    msPerTick: number;
    //Highest self time inside a single server tick
    peakMs: number;
    topCauses: ResourceMonitorCause[];
};

export type ResourceMonitorSample = {
    ts: number;
    //Ticks counted from the trace, or the requested frames when the trace had none
    ticks: number;
    ticksFromTrace: boolean;
    requestedFrames: number;
    //Wall time covered by the trace
    durationMs: number;
    trigger: 'schedule' | 'manual';
    //Sorted by msPerTick, heaviest first
    resources: ResourceMonitorResourceStat[];
};

//History in a compact shape: `values` holds [index into names, msPerTick]
export type ResourceMonitorHistoryPoint = {
    ts: number;
    values: [nameIndex: number, msPerTick: number][];
};
export type ResourceMonitorHistory = {
    names: string[];
    points: ResourceMonitorHistoryPoint[];
};

export type ResourceMonitorDiscordDelivery = 'sent' | 'off' | 'notConfigured' | 'notReady';
export type ResourceMonitorAlert = {
    id: string;
    ts: number;
    resource: string;
    msPerTick: number;
    thresholdMs: number;
    consecutive: number;
    discord: ResourceMonitorDiscordDelivery;
};

export type ResourceMonitorErrorCode =
    | 'server_offline'
    | 'server_booting'
    | 'not_configured'
    | 'already_sampling'
    | 'command_failed'
    | 'file_timeout'
    | 'invalid_trace'
    | 'no_resource_events'
    | 'unknown';

export type ResourceMonitorState = 'disabled' | 'waiting' | 'sampling' | 'serverOffline';
export type ResourceMonitorServerState = 'online' | 'booting' | 'offline';
export type ResourceMonitorStatus = {
    state: ResourceMonitorState;
    //A capture needs the game server running and booted
    server: ResourceMonitorServerState;
    lastSampleAt: number | null;
    nextSampleAt: number | null;
    samplingStartedAt: number | null;
    //Expected wall time of a capture, so the UI can tell how long to wait
    samplingExpectedMs: number;
    lastError: {
        ts: number;
        code: ResourceMonitorErrorCode;
        detail?: string;
    } | null;
    //The last scheduled sample that did not run, and why
    lastSkip: {
        ts: number;
        code: ResourceMonitorErrorCode;
    } | null;
};

export type ResourceMonitorDataResp = {
    serverNow: number;
    config: ResourceMonitorConfig;
    status: ResourceMonitorStatus;
    latest: ResourceMonitorSample | null;
    history: ResourceMonitorHistory;
    alerts: ResourceMonitorAlert[];
    //Discord bot enabled and a warnings channel set
    discordConfigured: boolean;
} | {
    error: string;
};

export type ResourceMonitorSettingsReq = ResourceMonitorConfig;

export type ResourceMonitorActionResp = {
    success: true;
} | {
    error: string;
    code?: ResourceMonitorErrorCode | 'no_permission' | 'invalid_request' | 'save_failed';
};
