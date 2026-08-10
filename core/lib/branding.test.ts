import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@core/globalData', () => ({
    txEnv: { profilePath: 'C:/txadmin-test-profile' },
}));

import { brandingUrl, readBrandingAsset } from './branding';

describe('branding assets', () => {
    beforeEach(() => {
        vi.stubGlobal('txConfig', {
            general: {
                accent: 'rose',
                serverName: 'Test Server',
                logoUrl: '',
                faviconUrl: '',
                bannerUrl: '',
            },
        });
    });

    afterEach(() => vi.unstubAllGlobals());

    it('routes in-game panel assets through WebPipe', () => {
        const url = new URL(brandingUrl('logo', false, 'https://monitor/WebPipe/'));

        expect(url.origin).toBe('https://monitor');
        expect(url.pathname).toBe('/WebPipe/branding/logo');
        expect(url.searchParams.has('v')).toBe(true);
    });

    it('uses embedded-browser-compatible RGB in generated fallback art', async () => {
        const asset = await readBrandingAsset('logo', true);
        const body = asset.body.toString('utf8');

        expect(asset.mime).toBe('image/svg+xml');
        expect(body).toContain('stop-color="rgb(');
        expect(body).not.toContain('oklch(');
    });
});
