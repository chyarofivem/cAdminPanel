import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FxMonitorHealth } from '@shared/enums';

import { generateStatusMessage } from './status';

describe('Discord status embed', () => {
    beforeEach(() => {
        vi.stubGlobal('txConfig', {
            general: { serverName: 'Test Server' },
        });
        vi.stubGlobal('txCore', {
            cacheStore: {
                get: vi.fn((key: string) => {
                    if (key === 'fxsRuntime:cfxId') return 'abc123';
                    if (key === 'fxsRuntime:maxClients') return 48;
                    return undefined;
                }),
            },
            fxMonitor: {
                status: {
                    health: FxMonitorHealth.ONLINE,
                    uptime: 120_000,
                },
            },
            fxPlayerlist: { onlineCount: 12 },
            fxScheduler: {
                getStatus: vi.fn(() => ({ nextRelativeMs: undefined })),
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('removes footer data from the status embed', () => {
        const message = generateStatusMessage(
            JSON.stringify({
                title: '{{serverName}}',
                footer: {
                    text: 'txAdmin 1.0.0',
                    icon_url: 'https://example.com/logo.png',
                },
            }),
            JSON.stringify({}),
        );
        const embed = message.embeds[0].toJSON();

        expect(embed.title).toBe('Test Server');
        expect(embed.footer).toBeUndefined();
        expect(embed.timestamp).toBeUndefined();
    });
});
