import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabasePlayerType } from '@modules/Database/databaseTypes';
import type FxPlayerlist from '@modules/FxPlayerlist';
import {
    isMatchingPlayerConnection,
    isMatchingPlayerSession,
    ServerPlayer,
} from './playerClasses';

const createPlayer = (netid: number, connectionRef: string) => new ServerPlayer(
    netid,
    {
        name: `Player ${netid}`,
        ids: [],
        hwids: [],
        connectionRef,
    },
    {} as FxPlayerlist,
);

describe('ServerPlayer connection identity', () => {
    it('keeps the resource connection reference and creates a unique backend session reference', () => {
        const first = createPlayer(42, 'resource-connection-42-a');
        const second = createPlayer(42, 'resource-connection-42-b');

        expect(first.connectionRef).toBe('resource-connection-42-a');
        expect(second.connectionRef).toBe('resource-connection-42-b');
        expect(first.sessionRef).not.toBe(second.sessionRef);
        expect(first.sessionRef).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('rejects stale and disconnected connection references', () => {
        const player = createPlayer(7, 'resource-connection-7');

        expect(isMatchingPlayerConnection(player, 'resource-connection-7')).toBe(true);
        expect(isMatchingPlayerConnection(player, 'resource-connection-old')).toBe(false);
        expect(isMatchingPlayerSession(player, player.sessionRef)).toBe(true);

        player.disconnect();

        expect(isMatchingPlayerConnection(player, 'resource-connection-7')).toBe(false);
        expect(isMatchingPlayerSession(player, player.sessionRef)).toBe(false);
    });
});

describe('ServerPlayer database identity resolution', () => {
    const oldLicense = 'a'.repeat(40);
    const currentLicense = 'b'.repeat(40);
    const makeRecord = (license: string, ids: string[]): DatabasePlayerType => ({
        license,
        ids,
        hwids: [],
        displayName: 'Stored player',
        pureName: 'stored player',
        playTime: 10,
        tsJoined: 1,
        tsLastConnection: 1,
    });

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('reuses one record matched through either license provider prefix', () => {
        const storedPlayer = makeRecord(oldLicense, [`license:${oldLicense}`]);
        const players = {
            findOne: vi.fn(() => null),
            findMany: vi.fn(() => [storedPlayer]),
            update: vi.fn((_license: string, data: Partial<DatabasePlayerType>) => ({ ...storedPlayer, ...data })),
            register: vi.fn(),
        };
        vi.stubGlobal('txCore', {
            database: { isReady: true, players, actions: { findMany: vi.fn(() => []) } },
            fxPlayerlist: { handleDbDataSync: vi.fn() },
        });

        const player = new ServerPlayer(8, {
            name: 'Returning player',
            ids: [`license:${currentLicense}`, `license2:${oldLicense}`],
            hwids: [],
            connectionRef: 'connection-8',
        }, { dispatchInitialPlayerData: vi.fn() } as unknown as FxPlayerlist);

        expect(player.license).toBe(oldLicense);
        expect(player.isRegistered).toBe(true);
        expect(players.update).toHaveBeenCalledWith(oldLicense, expect.any(Object), player.uniqueId);
        expect(players.register).not.toHaveBeenCalled();
        player.disconnect();
    });

    it('refuses an ambiguous association instead of creating another record', () => {
        const players = {
            findOne: vi.fn(() => null),
            findMany: vi.fn(() => [
                makeRecord(oldLicense, [`license:${oldLicense}`]),
                makeRecord('c'.repeat(40), [`license2:${oldLicense}`]),
            ]),
            update: vi.fn(),
            register: vi.fn(),
        };
        vi.stubGlobal('txCore', {
            database: { isReady: true, players, actions: { findMany: vi.fn(() => []) } },
            fxPlayerlist: { handleDbDataSync: vi.fn() },
        });

        const player = new ServerPlayer(9, {
            name: 'Ambiguous player',
            ids: [`license:${currentLicense}`, `license2:${oldLicense}`],
            hwids: [],
            connectionRef: 'connection-9',
        }, { dispatchInitialPlayerData: vi.fn() } as unknown as FxPlayerlist);

        expect(player.isRegistered).toBe(false);
        expect(players.update).not.toHaveBeenCalled();
        expect(players.register).not.toHaveBeenCalled();
        player.disconnect();
    });
});
