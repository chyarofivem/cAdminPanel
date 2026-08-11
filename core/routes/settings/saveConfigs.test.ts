import { afterEach, describe, expect, test, vi } from 'vitest';
import SaveSettingsConfigs, { handleAppearanceCard, handleDiscordCard } from './saveConfigs';
import { FxMonitorHealth } from '@shared/enums';

const makeCtx = (body: unknown) => {
    const send = vi.fn();
    return {
        send,
        ctx: {
            params: { card: 'bans' },
            request: { body },
            admin: {
                name: 'staff',
                isMaster: false,
                testPermission: vi.fn(() => true),
                hasPermission: vi.fn(() => true),
            },
            send,
        } as any,
    };
};

describe('settings save access', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('rejects a non-master token change sent through another card', async () => {
        const { ctx, send } = makeCtx({
            resetKeys: [],
            changes: { discordBot: { token: 'replacement-token' } },
        });

        await SaveSettingsConfigs(ctx);

        expect(send).toHaveBeenCalledWith({
            type: 'error',
            msg: 'Only the master can change this setting.',
        });
    });

    test('rejects a non-master token reset sent through another card', async () => {
        const { ctx, send } = makeCtx({
            resetKeys: ['discordBot.token'],
            changes: {},
        });

        await SaveSettingsConfigs(ctx);

        expect(send).toHaveBeenCalledWith({
            type: 'error',
            msg: 'Only the master can change this setting.',
        });
    });

    test('preserves the stored token when staff save other Discord settings', async () => {
        const attemptBotReset = vi.fn(async () => 'Discord bot ready.');
        vi.stubGlobal('txCore', { discordBot: { attemptBotReset } });
        const input = {
            discordBot: {
                enabled: true,
                guild: '123456789012345678',
                warningsChannel: null,
            },
        } as any;
        const send = vi.fn();

        const result = await handleDiscordCard(input, send, 'stored-token');

        expect(attemptBotReset).toHaveBeenCalledWith({
            enabled: true,
            token: 'stored-token',
            guild: '123456789012345678',
            warningsChannel: null,
        });
        expect(input.discordBot).not.toHaveProperty('token');
        expect(result?.processedConfig).toBe(input);
        expect(send).not.toHaveBeenCalled();
    });

    test('allows Appearance to save validated embed settings only', async () => {
        vi.stubGlobal('txConfig', {
            general: { serverName: 'Test Server' },
            discordBot: { embedJson: '{}', embedConfigJson: '{}' },
        });
        vi.stubGlobal('txCore', {
            cacheStore: { get: vi.fn(() => undefined) },
            fxMonitor: { status: { health: FxMonitorHealth.ONLINE, uptime: 0 } },
            fxPlayerlist: { onlineCount: 0 },
            fxScheduler: { getStatus: vi.fn(() => ({ nextRelativeMs: undefined })) },
        });
        const input = {
            discordBot: {
                embedJson: JSON.stringify({ title: '{{serverName}}' }),
                embedConfigJson: '{}',
            },
        } as any;

        await expect(handleAppearanceCard(input, vi.fn())).resolves.toEqual({ processedConfig: input });
        await expect(handleAppearanceCard({ discordBot: { guild: '123' } } as any, vi.fn()))
            .rejects.toThrow('Appearance access can only change embed appearance settings.');
    });

    test('redacts the token from a non-master save response', async () => {
        vi.stubGlobal('txCore', {
            configStore: {
                saveConfigs: vi.fn(() => ({ hasMatch: vi.fn(() => false) })),
                getStoredConfig: vi.fn(() => ({
                    discordBot: { token: 'discord-secret' },
                })),
                getChangelog: vi.fn(() => []),
            },
        });
        const { ctx, send } = makeCtx({ resetKeys: [], changes: {} });

        await SaveSettingsConfigs(ctx);

        expect(send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'success',
            stored: {
                discordBot: { token: '[redacted by txAdmin]' },
            },
        }));
    });
});
