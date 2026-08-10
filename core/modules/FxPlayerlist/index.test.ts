import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FxPlayerlist from './index';

const joinPayload = (connectionRef: string, resync = false) => ({
    type: 'txAdminPlayerlistEvent',
    event: 'playerJoining',
    id: 12,
    resync,
    player: {
        name: `Player ${connectionRef}`,
        ids: [],
        hwids: [],
        connectionRef,
    },
});

const dropPayload = (connectionRef?: string) => ({
    type: 'txAdminPlayerlistEvent',
    event: 'playerDropped',
    id: 12,
    reason: 'test',
    connectionRef,
});

describe('FxPlayerlist connection reuse', () => {
    beforeEach(() => {
        vi.stubGlobal('txCore', {
            logger: { server: { write: vi.fn() } },
            metrics: { playerDrop: { handlePlayerDrop: vi.fn(() => false) } },
            webServer: { webSocket: { buffer: vi.fn() } },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('keeps replacement B connected after late or tokenless drops for A', async () => {
        const playerlist = new FxPlayerlist();

        await playerlist.handleServerEvents(joinPayload('connection-a'), 'mutex');
        const playerA = playerlist.getPlayerById(12)!;
        await playerlist.handleServerEvents(joinPayload('connection-b'), 'mutex');
        const playerB = playerlist.getPlayerById(12)!;

        expect(playerA.isConnected).toBe(false);
        expect(playerB.isConnected).toBe(true);

        await playerlist.handleServerEvents(dropPayload('connection-a'), 'mutex');
        expect(playerB.isConnected).toBe(true);

        await playerlist.handleServerEvents(dropPayload(), 'mutex');
        expect(playerB.isConnected).toBe(true);

        await playerlist.handleServerEvents(dropPayload('connection-b'), 'mutex');
        expect(playerB.isConnected).toBe(false);
    });

    it('restores a missing live player without recording a new join', async () => {
        const playerlist = new FxPlayerlist();

        await playerlist.handleServerEvents(joinPayload('connection-a', true), 'mutex');
        const restoredPlayer = playerlist.getPlayerById(12);

        expect(restoredPlayer?.isConnected).toBe(true);
        expect(playerlist.joinLeaveLog).toEqual([]);
        expect(txCore.logger.server.write).not.toHaveBeenCalled();
        expect(txCore.webServer.webSocket.buffer).toHaveBeenCalledTimes(1);

        await playerlist.handleServerEvents(joinPayload('connection-a', true), 'mutex');
        expect(playerlist.getPlayerById(12)).toBe(restoredPlayer);
        expect(txCore.webServer.webSocket.buffer).toHaveBeenCalledTimes(1);
    });
});
