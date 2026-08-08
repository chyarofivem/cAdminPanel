import { describe, expect, it } from 'vitest';

import type { TxAdminLogEntry } from '@shared/txAdminLogTypes';
import { parseStoredTxAdminEntries, queryTxAdminEntries } from './TxAdminLogger';

const entries: TxAdminLogEntry[] = [
    { id: 'one', ts: 1, channel: 'server', type: 'playerJoining', src: { id: 'm#1', name: 'Alex' }, msg: 'joined' },
    { id: 'two', ts: 2, channel: 'action', type: 'AdminAction', src: { id: false, name: 'Root' }, msg: 'kicked Alex' },
    { id: 'three', ts: 3, channel: 'server', type: 'ChatMessage', src: { id: 'm#2', name: 'Sam' }, msg: 'hello' },
];

describe('combined txAdmin log helpers', () => {
    it('restores valid NDJSON entries and skips corrupt lines', () => {
        const raw = `${JSON.stringify(entries[0])}\nnot-json\n${JSON.stringify(entries[1])}\n`;
        expect(parseStoredTxAdminEntries(raw)).toEqual(entries.slice(0, 2));
    });

    it('returns newest entries first with a stable older cursor', () => {
        const firstPage = queryTxAdminEntries(entries, { limit: 2 });
        expect(firstPage.entries.map(entry => entry.id)).toEqual(['three', 'two']);
        expect(firstPage.nextCursor).toBe('two');
        expect(firstPage.hasMore).toBe(true);

        const nextPage = queryTxAdminEntries(entries, { limit: 2, before: firstPage.nextCursor! });
        expect(nextPage.entries.map(entry => entry.id)).toEqual(['one']);
        expect(nextPage.hasMore).toBe(false);
    });

    it('filters by channel and case-insensitive content', () => {
        expect(queryTxAdminEntries(entries, { channel: 'action' }).entries.map(entry => entry.id))
            .toEqual(['two']);
        expect(queryTxAdminEntries(entries, { query: 'ALEX' }).entries.map(entry => entry.id))
            .toEqual(['two', 'one']);
    });
});

