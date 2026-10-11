/**
 * FXServer build manager contracts (GET /fxBuilds/data, POST /fxBuilds/:action).
 * Build numbers are always positive integers; `null` in a build field means the
 * panel's own (host) build, which ships with the panel and never needs a download.
 */

export const fxBuildChannels = ['recommended', 'latest', 'optional', 'critical'] as const;
export type FxBuildChannel = typeof fxBuildChannels[number];

export type FxBuildPlatform = 'windows' | 'linux';

export type FxBuildDownloadPhase = 'downloading' | 'extracting' | 'installing' | 'done' | 'error';

export type FxBuildDownloadProgress = {
    build: number;
    phase: FxBuildDownloadPhase;
    receivedBytes: number;
    /** Null when the server did not send a content length. */
    totalBytes: number | null;
    /** Set when phase is `error`. */
    error: string | null;
    startedAt: number;
    updatedAt: number;
};

export type FxBuildPending = {
    build: number;
    failures: number;
};

export type FxBuildListItem = {
    build: number;
    tags: FxBuildChannel[];
    installed: boolean;
    isActive: boolean;
    /** The panel runs on this exact build, so using it needs no download. */
    isHost: boolean;
    /** A download source is known for this build and it is new enough. */
    downloadable: boolean;
};

export type FxInstalledBuild = {
    build: number;
    installedAt: number;
    sizeBytes: number;
    /** Version of the panel files copied into the build, null when unknown. */
    monitorVersion: string | null;
    isActive: boolean;
    isPrevious: boolean;
    /** False when the build folder or its executable is missing. */
    isAvailable: boolean;
};

/**
 * The last automatic change, kept until an administrator switches builds.
 * - `rolledBack`: a switched build failed to start twice and the server went back.
 * - `fellBack`: the active build was missing or broken, the server started on the panel build.
 */
export type FxBuildsNotice = {
    type: 'rolledBack';
    from: number;
    to: number;
    at: number;
} | {
    type: 'fellBack';
    build: number;
    hostBuild: number;
    at: number;
};

export type FxBuildsData = {
    platform: FxBuildPlatform;
    /** The build the panel itself runs on. */
    hostBuild: number;
    /** The build the game server starts on; null = the panel build. */
    activeBuild: number | null;
    /** The build a rollback returns to; null = the panel build. */
    previousBuild: number | null;
    /** Set after a switch until the server boots on that build. */
    pending: FxBuildPending | null;
    /** The build the running game server uses, null when the server is offline. */
    runningBuild: number | null;
    channels: Record<FxBuildChannel, number | null>;
    /** Unique builds behind the channels above, in channel order. */
    channelBuilds: FxBuildListItem[];
    recentBuilds: FxBuildListItem[];
    installed: FxInstalledBuild[];
    download: FxBuildDownloadProgress | null;
    providerManaged: boolean;
    providerName: string | null;
    /** Set when the Cfx.re build lists could not be loaded. */
    sourcesError: string | null;
    /** The last automatic rollback or fallback. */
    lastError: FxBuildsNotice | null;
};

export type FxBuildsDataResp = {
    success: true;
    data: FxBuildsData;
} | {
    success: false;
    error: string;
};

export type FxBuildsActionResp = {
    success: true;
    message: string;
} | {
    success: false;
    error: string;
};
