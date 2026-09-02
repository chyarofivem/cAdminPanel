import { afterEach, describe, expect, test, vi } from 'vitest';
import txAdminCmds from './txAdminCmds';

describe('advanced txAdmin config commands', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('rejects Discord bot token changes before saving', () => {
        const saveConfigs = vi.fn();
        vi.stubGlobal('txCore', { configStore: { saveConfigs } });
        const ctx = {
            admin: {
                name: 'master',
                isMaster: true,
                hasPermission: vi.fn(() => true),
            },
        } as any;

        expect(() => txAdminCmds.set(ctx, 'discordBot.token "secret"'))
            .toThrow('The Discord bot token can only be changed by the master in Settings.');
        expect(saveConfigs).not.toHaveBeenCalled();
    });

    test('redacts the stored token from non-master command output', async () => {
        vi.stubGlobal('txCore', {
            configStore: {
                saveConfigs: vi.fn(() => ({ raw: ['general.serverName'] })),
                getStoredConfig: vi.fn(() => ({
                    general: { serverName: 'Updated' },
                    discordBot: { token: 'discord-secret' },
                })),
            },
        });
        const ctx = {
            admin: {
                name: 'staff',
                isMaster: false,
                hasPermission: vi.fn(() => true),
            },
        } as any;

        const result = await txAdminCmds.set(ctx, 'general.serverName "Updated"');

        expect(result.data).not.toContain('discord-secret');
        expect(result.data).toContain('[redacted]');
    });
});
