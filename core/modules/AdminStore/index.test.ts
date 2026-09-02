import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hostConfig = vi.hoisted(() => ({
    root: '',
    defaults: { account: undefined as any },
    sourceName: 'test host',
    dataSubPath(filename: string) { return path.join(this.root, filename); },
}));
const sendEvent = vi.fn();

vi.mock('@core/globalData', () => ({
    txHostConfig: hostConfig,
    txEnv: { profilePath: '/tmp/cadminpanel-adminstore-profile' },
}));

import AdminStore from './index.js';

describe('AdminStore first-run account selection', () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        sendEvent.mockClear();
        hostConfig.root = await fs.mkdtemp(path.join(os.tmpdir(), 'cadminpanel-adminstore-'));
        hostConfig.defaults.account = undefined;
        vi.stubGlobal('txCore', {
            webServer: { webSocket: { reCheckAdminAuths: vi.fn(async () => undefined) } },
            fxPlayerlist: { getAssociatedOnlineNetIds: vi.fn(() => ({ idsFound: [] })) },
            fxRunner: { sendEvent },
        });
    });

    afterEach(async () => {
        await vi.runOnlyPendingTimersAsync();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        await fs.rm(hostConfig.root, { recursive: true, force: true });
    });

    it('creates the hosting-provided master instead of waiting for the console PIN', async () => {
        hostConfig.defaults.account = {
            username: 'hostadmin',
            fivemId: '271816',
            password: '$2b$11$K3HwDzkoUfhU6.W.tScfhOLEtR5uNc9qpQ685emtERx3dZ7fmgXCy',
        };

        const store = new AdminStore();
        if (store.refreshRoutine) clearInterval(store.refreshRoutine);
        const saved = JSON.parse(await fs.readFile(path.join(hostConfig.root, 'admins.json'), 'utf8'));

        expect(saved[0]).toMatchObject({
            name: 'hostadmin',
            master: true,
            password_hash: hostConfig.defaults.account.password,
            providers: { citizenfx: { identifier: 'fivem:271816' } },
        });
        expect(saved[0].password_temporary).toBeUndefined();
        expect(store.addMasterPin).toBeUndefined();
    });

    it('generates and stores a temporary local password for a FiveM-only host account', async () => {
        const generatedHash = '$2b$11$K3HwDzkoUfhU6.W.tScfhOLEtR5uNc9qpQ685emtERx3dZ7fmgXCy';
        const getPasswordHash = vi.fn((_password: string) => generatedHash);
        vi.stubGlobal('GetPasswordHash', getPasswordHash);
        hostConfig.defaults.account = {
            username: 'hostadmin',
            fivemId: '271816',
        };

        const store = new AdminStore();
        if (store.refreshRoutine) clearInterval(store.refreshRoutine);
        const saved = JSON.parse(await fs.readFile(path.join(hostConfig.root, 'admins.json'), 'utf8'));
        const generatedPassword = getPasswordHash.mock.calls[0]?.[0];

        expect(generatedPassword).toHaveLength(16);
        expect(saved[0]).toMatchObject({
            name: 'hostadmin',
            password_hash: generatedHash,
            password_temporary: true,
            providers: { citizenfx: { identifier: 'fivem:271816' } },
        });
    });

    it('retains the console-authorized master bootstrap without a default account', () => {
        const store = new AdminStore();

        expect(store.admins).toBe(false);
        expect(store.addMasterPin).toHaveLength(16);
    });

    it('does not register the retired troll permission', () => {
        const store = new AdminStore();
        expect(store.getPermissionsList()).not.toHaveProperty('players.troll');
    });

    it('loads a stored administrator file without rewriting it', async () => {
        const store = new AdminStore();
        const adminsPath = path.join(hostConfig.root, 'admins.json');
        const fileContent = JSON.stringify([{
            $schema: 1,
            name: 'hostadmin',
            master: true,
            password_hash: '$2b$11$K3HwDzkoUfhU6.W.tScfhOLEtR5uNc9qpQ685emtERx3dZ7fmgXCy',
            providers: {},
            permissions: ['players.kick'],
        }]);
        await fs.writeFile(adminsPath, fileContent);

        await store.loadAdminsFile();

        if (!Array.isArray(store.admins)) throw new Error('AdminStore did not load administrators.');
        expect(store.admins[0].permissions).toEqual(['players.kick']);
        expect(await fs.readFile(adminsPath, 'utf8')).toBe(fileContent);
    });

    it('preserves a registered administrator password during management edits', async () => {
        const originalHash = '$2b$11$K3HwDzkoUfhU6.W.tScfhOLEtR5uNc9qpQ685emtERx3dZ7fmgXCy';
        hostConfig.defaults.account = {
            username: 'hostadmin',
            password: originalHash,
        };
        const store = new AdminStore();
        if (store.refreshRoutine) clearInterval(store.refreshRoutine);
        if (!Array.isArray(store.admins)) throw new Error('AdminStore did not create the host administrator.');

        await (store.editAdmin as (...args: any[]) => Promise<boolean>)(
            'hostadmin',
            undefined,
            undefined,
            [],
            'replacement-password',
        );

        expect(store.admins[0].password_hash).toBe(originalHash);
        expect(store.admins[0].password_temporary).toBeUndefined();
    });

    it('persists administrator preferences used by web and game sessions', async () => {
        hostConfig.defaults.account = {
            username: 'hostadmin',
            password: '$2b$11$K3HwDzkoUfhU6.W.tScfhOLEtR5uNc9qpQ685emtERx3dZ7fmgXCy',
        };
        const store = new AdminStore();
        if (store.refreshRoutine) clearInterval(store.refreshRoutine);

        await store.setAdminPreferences('hostadmin', { locale: 'hr', accent: 'rose' });

        const saved = JSON.parse(await fs.readFile(path.join(hostConfig.root, 'admins.json'), 'utf8'));
        expect(saved[0].preferences).toEqual({ locale: 'hr', accent: 'rose' });
        expect(sendEvent).toHaveBeenCalledWith('adminPreferencesUpdated', {
            username: 'hostadmin',
            locale: 'hr',
            accent: 'rose',
            accentColor: '#e11d48',
        });
        expect(txCore.webServer.webSocket.reCheckAdminAuths).not.toHaveBeenCalled();
    });
});
