import fs from 'node:fs';
import type { Options as RfsOptions } from 'rotating-file-stream';

import type {
    TxAdminLogApiResponse,
    TxAdminLogChannel,
    TxAdminLogEntry,
    TxAdminLogQuery,
    TxAdminLogSource,
} from '@shared/txAdminLogTypes';
import { LoggerBase } from './LoggerBase';

const RECENT_BUFFER_LIMIT = 32_000;
const ACTIVE_FILE_TAIL_LIMIT = 16 * 1024 * 1024;

const sanitizeSingleLine = (value: unknown, fallback: string) => {
    const text = typeof value === 'string' ? value : fallback;
    return text.replace(/\r?\n/g, '\t').replaceAll('\0', '').trim();
};

export const parseStoredTxAdminEntries = (raw: string): TxAdminLogEntry[] => {
    const entries: TxAdminLogEntry[] = [];
    for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
            const parsed = JSON.parse(line) as Partial<TxAdminLogEntry>;
            if (
                typeof parsed.id !== 'string'
                || typeof parsed.ts !== 'number'
                || !Number.isFinite(parsed.ts)
                || (parsed.channel !== 'action' && parsed.channel !== 'server')
                || typeof parsed.type !== 'string'
                || typeof parsed.msg !== 'string'
                || !parsed.src
                || (typeof parsed.src.id !== 'string' && parsed.src.id !== false)
                || typeof parsed.src.name !== 'string'
            ) {
                continue;
            }
            entries.push(parsed as TxAdminLogEntry);
        } catch {
            // A partial final write or a line from a pre-NDJSON build is safe to skip.
        }
    }
    return entries;
};

export const queryTxAdminEntries = (
    recentBuffer: TxAdminLogEntry[],
    query: TxAdminLogQuery,
): TxAdminLogApiResponse => {
    const channel = query.channel;
    const search = query.query?.trim().toLocaleLowerCase();
    const limit = Math.max(1, Math.min(500, query.limit ?? 200));
    const filtered = recentBuffer.filter(entry => {
        if (channel && entry.channel !== channel) return false;
        if (!search) return true;
        return [entry.type, entry.src.name, entry.src.id || '', entry.msg]
            .some(value => value.toLocaleLowerCase().includes(search));
    });

    let endIndex = filtered.length;
    if (query.before) {
        const cursorIndex = filtered.findIndex(entry => entry.id === query.before);
        endIndex = cursorIndex === -1 ? 0 : cursorIndex;
    }
    const startIndex = Math.max(0, endIndex - limit);
    const entries = filtered.slice(startIndex, endIndex).reverse();
    const hasMore = startIndex > 0;
    return {
        entries,
        nextCursor: hasMore && entries.length ? entries[entries.length - 1].id : null,
        hasMore,
    };
};

const readFileTail = (filePath: string, maxBytes = ACTIVE_FILE_TAIL_LIMIT) => {
    let fileDescriptor: number | undefined;
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size === 0) return '';
        const bytesToRead = Math.min(stat.size, maxBytes);
        const start = stat.size - bytesToRead;
        const buffer = Buffer.allocUnsafe(bytesToRead);
        fileDescriptor = fs.openSync(filePath, 'r');
        fs.readSync(fileDescriptor, buffer, 0, bytesToRead, start);
        let raw = buffer.toString('utf8');
        if (start > 0) {
            const firstLineBreak = raw.indexOf('\n');
            raw = firstLineBreak === -1 ? '' : raw.slice(firstLineBreak + 1);
        }
        return raw;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
        throw error;
    } finally {
        if (fileDescriptor !== undefined) fs.closeSync(fileDescriptor);
    }
};

const enforceDailyRotation = (profileConfig: RfsOptions | false): RfsOptions | false => {
    if (profileConfig === false) return false;
    const {
        interval: _interval,
        intervalBoundary: _intervalBoundary,
        initialRotation: _initialRotation,
        ...storageOptions
    } = profileConfig;
    return {
        ...storageOptions,
        interval: '1d',
        intervalBoundary: true,
        // On process boot, rotate only when the active file belongs to an
        // earlier daily interval. RFS does not rotate a current-day file.
        initialRotation: true,
    };
};

type ServerEntryInput = {
    ts: number;
    type: string;
    src: TxAdminLogSource;
    msg: string;
};

/**
 * Persistent combined stream for in-server events and administrative actions.
 * The active file uses newline-delimited JSON so it can be restored after a
 * txAdmin process restart without loading an entire log into memory.
 */
export default class TxAdminLogger extends LoggerBase {
    private recentBuffer: TxAdminLogEntry[] = [];
    private sequence = 0;
    private writes = 0;

    constructor(basePath: string, profileConfig: RfsOptions | false) {
        const defaultOptions: RfsOptions = {
            path: basePath,
            history: 'txadmin.history',
            interval: '1d',
            intervalBoundary: true,
            initialRotation: true,
            maxFiles: 7,
            maxSize: '10G',
        };
        super(
            basePath,
            'txadmin',
            defaultOptions,
            enforceDailyRotation(profileConfig),
            false,
        );

        if (this.persistentLoggingEnabled) {
            this.recentBuffer = parseStoredTxAdminEntries(readFileTail(this.activeFilePath))
                .slice(-RECENT_BUFFER_LIMIT);
            this.lrStream.on('rotated', () => {
                this.recentBuffer = [];
            });
        }
    }

    private createId(timestamp: number) {
        this.sequence++;
        return `${timestamp.toString(36)}-${process.pid.toString(36)}-${this.sequence.toString(36)}`;
    }

    private append(
        channel: TxAdminLogChannel,
        type: string,
        source: TxAdminLogSource,
        message: string,
        timestamp = Date.now(),
    ) {
        const safeTimestamp = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
        const entry: TxAdminLogEntry = {
            id: this.createId(safeTimestamp),
            ts: safeTimestamp,
            channel,
            type: sanitizeSingleLine(type, 'UnknownEvent') || 'UnknownEvent',
            src: {
                id: typeof source.id === 'string' ? sanitizeSingleLine(source.id, '') : false,
                name: sanitizeSingleLine(source.name, 'UNKNOWN') || 'UNKNOWN',
            },
            msg: sanitizeSingleLine(message, 'unknown event') || 'unknown event',
        };

        this.recentBuffer.push(entry);
        if (this.recentBuffer.length > RECENT_BUFFER_LIMIT) {
            this.recentBuffer.splice(0, this.recentBuffer.length - RECENT_BUFFER_LIMIT);
        }
        this.writes++;
        this.lrStream.write(`${JSON.stringify(entry)}\n`);
        txCore.webServer.webSocket.buffer('serverlog', entry);
        return entry;
    }

    writeAction(author: string, message: string, type = 'AdminAction') {
        return this.append('action', type, { id: false, name: author }, message);
    }

    writeServer(entry: ServerEntryInput) {
        return this.append('server', entry.type, entry.src, entry.msg, entry.ts);
    }

    getRecentBuffer(lastN?: number) {
        return lastN ? this.recentBuffer.slice(-lastN) : [...this.recentBuffer];
    }

    getRecentActionText() {
        return this.recentBuffer
            .filter(entry => entry.channel === 'action')
            .map(entry => {
                const timestamp = new Date(entry.ts).toLocaleTimeString();
                return `[${timestamp}][${entry.src.name}] ${entry.msg}`;
            })
            .join('\n');
    }

    query(query: TxAdminLogQuery): TxAdminLogApiResponse {
        return queryTxAdminEntries(this.recentBuffer, query);
    }

    getUsageStats() {
        return {
            buffer: this.recentBuffer.length,
            writes: this.writes,
            lrErrors: this.lrErrors,
        };
    }
}
