import { describe, expect, it } from 'vitest';
import FxResources from './FxResources';

describe('FxResources reports', () => {
    it('stores valid reports and rejects malformed reports', () => {
        const resources = new FxResources();
        const report = [{ name: 'monitor', state: 'started' }];

        expect(resources.tmpUpdateResourceList(report)).toBe(true);
        expect(resources.resourceReport?.resources).toEqual(report);
        expect(resources.tmpUpdateResourceList('invalid' as any)).toBe(false);
        expect(resources.resourceReport?.resources).toEqual(report);
    });

    it('clears cached reports when the server closes', () => {
        const resources = new FxResources();
        resources.tmpUpdateResourceList([{ name: 'monitor', state: 'started' }]);

        resources.handleServerClose();

        expect(resources.resourceReport).toBeUndefined();
    });
});
