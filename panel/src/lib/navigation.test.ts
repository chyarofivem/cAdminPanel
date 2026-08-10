import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPanelLocation, isValidRedirectPath, reloadPanel } from './navigation';

const setWindow = (
    isWebInterface: boolean,
    href = 'https://monitor/settings?tab=appearance#branding',
) => {
    const location = new URL(href);
    const assign = vi.fn();
    Object.defineProperties(location, {
        assign: { value: assign },
        reload: { value: vi.fn() },
    });
    vi.stubGlobal('window', {
        location,
        txConsts: { isWebInterface },
    });
    return { assign };
};

describe('panel navigation', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('keeps internal routes unchanged in the web interface', () => {
        setWindow(true);
        expect(getPanelLocation('/settings?tab=appearance#branding'))
            .toBe('/settings?tab=appearance#branding');
    });

    it('routes full navigations through WebPipe inside NUI', () => {
        setWindow(false);
        expect(getPanelLocation('/settings?tab=appearance#branding'))
            .toBe('https://monitor/WebPipe/settings?tab=appearance#branding');
    });

    it('rejects external redirect paths', () => {
        setWindow(false);
        expect(() => getPanelLocation('//example.com/settings')).toThrow('Invalid internal panel location.');
    });

    it('fails closed for malformed redirect paths', () => {
        setWindow(false);
        expect(isValidRedirectPath('//[')).toBe(false);
        expect(() => getPanelLocation('//[')).toThrow('Invalid internal panel location.');
    });

    it('keeps normalized dot-segment paths inside WebPipe', () => {
        setWindow(false);
        expect(getPanelLocation('/../settings'))
            .toBe('https://monitor/WebPipe/settings');
        expect(getPanelLocation('/account/%2e%2e/settings?tab=appearance'))
            .toBe('https://monitor/WebPipe/settings?tab=appearance');
    });

    it('reloads an existing WebPipe route without duplicating its prefix', () => {
        const { assign } = setWindow(
            false,
            'https://monitor/WebPipe/settings?tab=appearance#branding',
        );

        reloadPanel();

        expect(assign).toHaveBeenCalledWith(
            'https://monitor/WebPipe/settings?tab=appearance#branding',
        );
    });
});
