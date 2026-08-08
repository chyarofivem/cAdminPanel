import { describe, expect, it } from 'vitest';
import { safeLocalRedirect } from './chyaroLogin';

describe('safeLocalRedirect', () => {
    it('keeps local paths with query strings and hashes', () => {
        expect(safeLocalRedirect('/administration/players/abc?character=cid#overview'))
            .toBe('/administration/players/abc?character=cid#overview');
    });

    it.each([
        'https://example.com',
        '//example.com/path',
        '/\\example.com/path',
        '/path\nnext',
        '',
    ])('rejects unsafe redirect %j', value => {
        expect(safeLocalRedirect(value)).toBeUndefined();
    });
});
