import { afterEach, describe, expect, it, vi } from 'vitest';
import consts from '@shared/consts';
import AuthBootstrapMaster from './bootstrapMaster';

const validPin = 'CONSOLEPIN123456';

const makeCtx = (body: unknown) => ({
    query: {},
    request: { body },
    ip: '10.0.0.5',
    txVars: { hostType: 'localhost' },
    sessTools: { set: vi.fn() },
    send: vi.fn((value: unknown) => value),
}) as any;

const stubCore = (overrides: Record<string, any> = {}) => {
    const adminStore = {
        hasAdmins: vi.fn(() => false),
        validateAddMasterPin: vi.fn(() => true),
        genCsrfToken: vi.fn(() => 'csrf-token'),
        createAdminsFile: vi.fn(() => ({
            name: 'owner',
            master: true,
            permissions: [],
            password_hash: '$2b$hash',
            providers: {},
        })),
        ...overrides,
    };
    vi.stubGlobal('txCore', {
        adminStore,
        cacheStore: { get: vi.fn() },
        logger: { admin: { write: vi.fn() } },
        metrics: {
            txRuntime: {
                loginOrigins: { count: vi.fn() },
                loginMethods: { count: vi.fn() },
            },
        },
    });
    return adminStore;
};

describe('master account bootstrap', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('creates the master account and opens a password session with a valid PIN', async () => {
        const adminStore = stubCore();
        const ctx = makeCtx({ pin: validPin, username: 'owner', password: 'a-good-password' });

        await AuthBootstrapMaster(ctx);

        expect(adminStore.createAdminsFile).toHaveBeenCalledWith(
            'owner', undefined, undefined, 'a-good-password', true, false,
        );
        expect(ctx.sessTools.set).toHaveBeenCalledWith({
            auth: {
                type: 'password',
                username: 'owner',
                password_hash: '$2b$hash',
                expiresAt: false,
                csrfToken: 'csrf-token',
            },
        });
        expect(ctx.send).toHaveBeenCalledWith(expect.objectContaining({
            name: 'owner',
            isMaster: true,
            csrfToken: 'csrf-token',
        }));
    });

    it('rejects a wrong PIN without creating the admins file', async () => {
        const adminStore = stubCore({ validateAddMasterPin: vi.fn(() => false) });
        const ctx = makeCtx({ pin: 'wrong-pin', username: 'owner', password: 'a-good-password' });

        await AuthBootstrapMaster(ctx);

        expect(adminStore.createAdminsFile).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith({
            error: 'Wrong PIN. Check the server console for the current one.',
        });
    });

    it('refuses to run once an administrator exists', async () => {
        const adminStore = stubCore({ hasAdmins: vi.fn(() => true) });
        const ctx = makeCtx({ pin: validPin, username: 'owner', password: 'a-good-password' });

        await AuthBootstrapMaster(ctx);

        expect(adminStore.validateAddMasterPin).not.toHaveBeenCalled();
        expect(adminStore.createAdminsFile).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith({
            error: 'The master account already exists, sign in with its username and password.',
        });
    });

    it('rejects a password below the minimum length', async () => {
        const adminStore = stubCore();
        const ctx = makeCtx({ pin: validPin, username: 'owner', password: 'abc' });

        await AuthBootstrapMaster(ctx);

        expect(adminStore.createAdminsFile).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith({
            error: `Password must be between ${consts.adminPasswordMinLength} and ${consts.adminPasswordMaxLength} characters.`,
        });
    });

    it('rejects a username that does not follow the local account rule', async () => {
        const adminStore = stubCore();
        const ctx = makeCtx({ pin: validPin, username: 'a b', password: 'a-good-password' });

        await AuthBootstrapMaster(ctx);

        expect(adminStore.createAdminsFile).not.toHaveBeenCalled();
        expect(ctx.send).toHaveBeenCalledWith({
            error: 'Invalid username, it must have 3 to 20 characters containing only letters, numbers and the characters `_.-`.',
        });
    });
});
