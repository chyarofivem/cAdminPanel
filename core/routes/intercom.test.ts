import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@core/globalData', () => ({
    txEnv: {
        profilePath: 'C:/txadmin-test-profile',
        txaVersion: '1.0.0-test',
    },
}));

import Intercom from './intercom';

describe('intercom branding context', () => {
    beforeEach(() => {
        vi.stubGlobal('txConfig', {
            general: {
                accent: 'rose',
                serverName: 'Test Server',
                logoUrl: `${'a'.repeat(64)}.png`,
                faviconUrl: '',
                bannerUrl: `${'b'.repeat(64)}.webp`,
            },
        });
    });

    afterEach(() => vi.unstubAllGlobals());

    it('sends cache-busted WebPipe asset URLs instead of image data', async () => {
        const ctx = {
            params: { scope: 'branding' },
            request: { body: {} },
            send: vi.fn((value: unknown) => value),
            utils: { error: vi.fn() },
        } as any;

        const response = await Intercom(ctx) as any;
        const logoUrl = new URL(response.logoUrl);
        const bannerUrl = new URL(response.bannerUrl);

        expect(response).toMatchObject({
            success: true,
            panelName: 'Test Server Panel',
            accent: 'rose',
            accentColor: '#e11d48',
        });
        expect(logoUrl.origin).toBe('https://monitor');
        expect(logoUrl.pathname).toBe('/WebPipe/branding/logo');
        expect(logoUrl.searchParams.get('v')).toBe(`${'a'.repeat(64)}.png`);
        expect(bannerUrl.pathname).toBe('/WebPipe/branding/banner');
        expect(bannerUrl.searchParams.get('v')).toBe(`${'b'.repeat(64)}.webp`);
        expect(response.logoUrl).not.toMatch(/^data:/);
        expect(response.bannerUrl).not.toMatch(/^data:/);
    });

    it('accepts a resource report and acknowledges it immediately', async () => {
        const tmpUpdateResourceList = vi.fn(() => true);
        vi.stubGlobal('txCore', {
            fxResources: { tmpUpdateResourceList },
        });
        const resources = [{ name: 'monitor', state: 'started' }];
        const ctx = {
            params: { scope: 'resources' },
            request: { body: { resources } },
            send: vi.fn((value: unknown) => value),
            utils: { error: vi.fn() },
        } as any;

        const response = await Intercom(ctx);

        expect(tmpUpdateResourceList).toHaveBeenCalledWith(resources);
        expect(response).toEqual({ success: true, txAdminVersion: '1.0.0-test' });
        expect(ctx.utils.error).not.toHaveBeenCalled();
    });

    it('rejects malformed resource reports', async () => {
        vi.stubGlobal('txCore', {
            fxResources: { tmpUpdateResourceList: vi.fn() },
        });
        const ctx = {
            params: { scope: 'resources' },
            request: { body: { resources: 'invalid' } },
            send: vi.fn((value: unknown) => value),
            utils: { error: vi.fn((status: number, message: string) => ({ status, message })) },
        } as any;

        const response = await Intercom(ctx);

        expect(response).toEqual({ status: 400, message: 'Invalid Request' });
        expect(txCore.fxResources.tmpUpdateResourceList).not.toHaveBeenCalled();
    });
});
