import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    cadminRequest: vi.fn(),
    fetchChyaroUsers: vi.fn(),
    findPlayersByIdentifier: vi.fn(),
    playerResolver: vi.fn(),
}));

vi.mock('@lib/cadminApi', async importOriginal => ({
    ...await importOriginal<typeof import('@lib/cadminApi')>(),
    cadminRequest: mocks.cadminRequest,
    requireCadminPermission: vi.fn(() => true),
}));
vi.mock('@lib/chyaroApi', () => ({ fetchChyaroUsers: mocks.fetchChyaroUsers }));
vi.mock('@lib/player/playerFinder', () => ({ findPlayersByIdentifier: mocks.findPlayersByIdentifier }));
vi.mock('@lib/player/playerResolver', () => ({ default: mocks.playerResolver }));

import CadminPlayer from './player';

describe('cAdmin character account association', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.playerResolver.mockImplementation(() => { throw new Error('not a primary license'); });
        mocks.findPlayersByIdentifier.mockReturnValue([]);
    });

    it('associates character details through a stored alternate license2 identifier', async () => {
        const primary = 'abcdef0123456789abcdef0123456789abcdef01';
        const alternate = '1234567890abcdef1234567890abcdef12345678';
        const account = { id: 7, fivemLicense: `license:${primary}` };
        const txPlayer = {
            license: primary,
            allIdentifiers: [`license:${primary}`, `license2:${alternate}`],
        };
        mocks.cadminRequest.mockResolvedValue({
            characterId: 'QBX12345',
            playerLicense: `license2:${alternate}`,
            vehicles: [],
        });
        mocks.findPlayersByIdentifier.mockImplementation((identifier: string) => (
            identifier === `license2:${alternate}` ? [txPlayer] : []
        ));
        mocks.fetchChyaroUsers.mockResolvedValue([account]);

        const ctx: any = {
            params: { identifier: 'QBX12345' },
            query: {},
            admin: { hasPermission: vi.fn(() => true) },
            send: vi.fn((value: unknown) => value),
        };
        await CadminPlayer(ctx);

        expect(mocks.findPlayersByIdentifier).toHaveBeenCalledWith(`license2:${alternate}`);
        expect(ctx.send).toHaveBeenCalledWith({
            success: true,
            data: expect.objectContaining({ account }),
        });
    });

    it('resolves a bare scope lookup through an alternate license2 identifier', async () => {
        const primary = 'abcdef0123456789abcdef0123456789abcdef01';
        const alternate = '1234567890abcdef1234567890abcdef12345678';
        const account = { id: 7, fivemLicense: `license:${primary}` };
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
        mocks.fetchChyaroUsers.mockResolvedValue([account]);

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
            data: [expect.objectContaining({ characterId: 'QBX12345', account })],
        });
    });

    it('keeps character details usable when account metadata is unavailable', async () => {
        mocks.cadminRequest.mockResolvedValue({
            characterId: 'QBX12345',
            vehicles: [],
        });
        mocks.fetchChyaroUsers.mockResolvedValue([]);

        const ctx: any = {
            params: { identifier: 'QBX12345' },
            query: {},
            admin: { hasPermission: vi.fn(() => true) },
            send: vi.fn((value: unknown) => value),
        };
        await CadminPlayer(ctx);

        expect(ctx.send).toHaveBeenCalledWith({
            success: true,
            data: expect.objectContaining({ account: null }),
        });
    });
});
