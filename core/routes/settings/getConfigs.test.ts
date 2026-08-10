import { afterEach, describe, expect, test, vi } from 'vitest';
import GetSettingsConfigs from './getConfigs';

describe('settings config visibility', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('redacts the Discord bot token for a non-master settings writer', async () => {
        vi.stubGlobal('txCore', {
            configStore: {
                getStoredConfig: vi.fn(() => ({
                    cadmin: { apiUrl: 'http://127.0.0.1:40120/cadminpanel' },
                    discordBot: {
                        enabled: true,
                        token: 'discord-secret',
                        guild: '123456789012345678',
                    },
                })),
                getChangelog: vi.fn(() => []),
            },
        });
        const send = vi.fn();
        const ctx = {
            admin: {
                isMaster: false,
                testPermission: vi.fn(() => true),
                hasPermission: vi.fn(() => true),
            },
            send,
        } as any;

        await GetSettingsConfigs(ctx);

        expect(send).toHaveBeenCalledWith(expect.objectContaining({
            storedConfigs: expect.objectContaining({
                discordBot: {
                    enabled: true,
                    token: '[redacted by txAdmin]',
                    guild: '123456789012345678',
                },
            }),
        }));
    });
});
