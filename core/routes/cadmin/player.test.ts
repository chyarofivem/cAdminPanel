import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    cadminRequest: vi.fn(),
    findPlayersByIdentifier: vi.fn(),
    playerResolver: vi.fn(),
}));

vi.mock('@lib/cadminApi', async importOriginal => ({
    ...await importOriginal<typeof import('@lib/cadminApi')>(),
    cadminRequest: mocks.cadminRequest,
    requireCadminPermission: vi.fn(() => true),
}));
vi.mock('@lib/player/playerFinder', () => ({ findPlayersByIdentifier: mocks.findPlayersByIdentifier }));
vi.mock('@lib/player/playerResolver', () => ({ default: mocks.playerResolver }));

import CadminPlayer from './player';

const primary = 'abcdef0123456789abcdef0123456789abcdef01';
const alternate = '1234567890abcdef1234567890abcdef12345678';

describe('cAdmin character lookups', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.playerResolver.mockImplementation(() => { throw new Error('not a primary license'); });
        mocks.findPlayersByIdentifier.mockReturnValue([]);
    });

    it('resolves a player scope lookup through a stored alternate license2 identifier', async () => {
        const txPlayer = {
            license: primary,
            allIdentifiers: [`license:${primary}`, `license2:${alternate}`],
        };
        mocks.findPlayersByIdentifier.mockImplementation((identifier: string) => (
            identifier === `license2:${alternate}` ? [txPlayer] : []
        ));
        mocks.cadminRequest.mockImplementation((_method: string, endpoint: string) => (
            decodeURIComponent(endpoint).includes(`license2:${alternate}`)
                ? [{ characterId: 'QBX12345', playerLicense: `license2:${alternate}` }]
                : []
        ));

        const ctx: any = {
            params: { identifier: alternate },
            query: { scope: 'player' },
            admin: { hasPermission: vi.fn(() => true) },
            send: vi.fn((value: unknown) => value),
        };
        await CadminPlayer(ctx);

        expect(mocks.findPlayersByIdentifier).toHaveBeenCalledWith(`license2:${alternate}`);
        expect(ctx.send).toHaveBeenCalledWith({
            success: true,
            data: [expect.objectContaining({ characterId: 'QBX12345' })],
        });
    });

    it('refuses to merge the characters of two player records sharing an identifier', async () => {
        mocks.findPlayersByIdentifier.mockReturnValue([
            { license: primary, allIdentifiers: [`license:${primary}`] },
            { license: alternate, allIdentifiers: [`license:${alternate}`] },
        ]);

        const ctx: any = {
            params: { identifier: alternate },
            query: { scope: 'player' },
            admin: { hasPermission: vi.fn(() => true) },
            send: vi.fn((value: unknown) => value),
        };
        await CadminPlayer(ctx);

        expect(mocks.cadminRequest).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith({
            success: false,
            error: 'That FiveM identifier is associated with more than one player record.',
        });
    });

    it('hides the garage from a character lookup without the garage permission', async () => {
        mocks.cadminRequest.mockResolvedValue({
            characterId: 'QBX12345',
            playerLicense: `license:${primary}`,
            vehicles: [{ plate: 'ABC 123' }],
        });

        const ctx: any = {
            params: { identifier: 'QBX12345' },
            query: {},
            admin: { hasPermission: vi.fn((permission: string) => permission !== 'cadmin.garage.view') },
            send: vi.fn((value: unknown) => value),
        };
        await CadminPlayer(ctx);

        expect(ctx.send).toHaveBeenCalledWith({
            success: true,
            data: { characterId: 'QBX12345', playerLicense: `license:${primary}` },
        });
    });
});
