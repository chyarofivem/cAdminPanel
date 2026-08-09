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

vi.mock('@core/globalData', () => ({ txHostConfig: hostConfig }));

import AdminStore from './index.js';

describe('AdminStore first-run account selection', () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        hostConfig.root = await fs.mkdtemp(path.join(os.tmpdir(), 'txadmin-adminstore-'));
        hostConfig.defaults.account = undefined;
        vi.stubGlobal('txCore', {
            webServer: { webSocket: { reCheckAdminAuths: vi.fn(async () => undefined) } },
            fxPlayerlist: { getAssociatedOnlineNetIds: vi.fn(() => ({ idsFound: [] })) },
            fxRunner: { sendEvent: vi.fn() },
        });
    });

    afterEach(async () => {
        await vi.runOnlyPendingTimersAsync();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        await fs.rm(hostConfig.root, { recursive: true, force: true });
    });

    it('creates the hosting-provided master instead of forcing chyarologin bootstrap', async () => {
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
        const getPasswordHash = vi.fn(() => generatedHash);
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

    it('retains the console-authorized chyarologin bootstrap without a default account', () => {
        const store = new AdminStore();

        expect(store.admins).toBe(false);
        expect(store.addMasterPin).toHaveLength(16);
    });

    it('removes a manual Discord provider when chyarologin is linked', async () => {
        hostConfig.defaults.account = {
            username: 'hostadmin',
            password: '$2b$11$K3HwDzkoUfhU6.W.tScfhOLEtR5uNc9qpQ685emtERx3dZ7fmgXCy',
        };
        const store = new AdminStore();
        if (store.refreshRoutine) clearInterval(store.refreshRoutine);
        store.admins[0].providers.discord = {
            id: '272800190639898628',
            identifier: 'discord:272800190639898628',
            data: {},
        };

        await store.editAdmin('hostadmin', undefined, undefined, 'host@example.com');

        expect(store.admins[0].providers.chyarologin.identifier).toBe('host@example.com');
        expect(store.admins[0].providers.discord).toBeUndefined();
    });
});
