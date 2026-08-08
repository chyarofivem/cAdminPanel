export type TxAdminLogChannel = 'action' | 'server';

export type TxAdminLogSource = {
    id: string | false;
    name: string;
};

/**
 * One normalized entry in the combined txAdmin log.
 *
 * `src` and `msg` intentionally retain the old server-log field names so a
 * rolling upgrade can keep using the existing websocket room safely.
 */
export type TxAdminLogEntry = {
    id: string;
    ts: number;
    channel: TxAdminLogChannel;
    type: string;
    src: TxAdminLogSource;
    msg: string;
};

export type TxAdminLogQuery = {
    before?: string;
    limit?: number;
    channel?: TxAdminLogChannel;
    query?: string;
};

export type TxAdminLogApiResponse = {
    entries: TxAdminLogEntry[];
    nextCursor: string | null;
    hasMore: boolean;
};

