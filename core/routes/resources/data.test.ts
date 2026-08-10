import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResourcesData from './data';

const sendCommand = vi.fn(() => true);

describe('resources data', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-10T12:00:00Z'));
        sendCommand.mockClear();
        vi.stubGlobal('txConfig', {
            server: { dataPath: 'C:/server-data' },
        });
        vi.stubGlobal('txCore', {
            fxRunner: {
                child: { isAlive: true },
                sendCommand,
            },
            fxResources: {
                resourceReport: {
                    ts: new Date('2026-08-10T11:59:00Z'),
                    resources: [{
                        name: 'monitor',
                        status: 'started',
                        path: 'C:/server-data/resources/[system]/monitor',
                    }],
                },
            },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('returns the cached report if a fresh response misses the deadline', async () => {
        const ctx = {
            send: vi.fn((value: unknown) => value),
        } as any;

        const responsePromise = ResourcesData(ctx);
        await vi.advanceTimersByTimeAsync(8_000);
        const response = await responsePromise;

        expect(sendCommand).toHaveBeenCalledWith('txaReportResources', [], expect.any(Symbol));
        expect(response).toMatchObject({
            success: true,
            data: {
                generatedAt: new Date('2026-08-10T11:59:00Z').getTime(),
                resources: [{ name: 'monitor', status: 'started' }],
            },
        });
    });
});
