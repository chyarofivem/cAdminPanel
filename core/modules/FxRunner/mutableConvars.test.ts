import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMutableConvars } from './utils';

const stubConfig = (whitelist: { mode: string; rejectionMessage: string }) => {
    vi.stubGlobal('txConfig', {
        general: { language: 'en', serverName: 'Test Server' },
        banlist: { enabled: true },
        whitelist,
        gameFeatures: {
            menuAlignRight: false,
            menuPageKey: 'Tab',
            playerModePtfx: true,
            hideAdminInPunishments: true,
            hideAdminInMessages: false,
            hideDefaultAnnouncement: false,
            hideDefaultDirectMessage: false,
            hideDefaultWarning: false,
            hideDefaultScheduledRestartWarning: false,
        },
    });
};

describe('mutable convars', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('never sends an empty value, which FXServer rejects as an argument count mismatch', () => {
        stubConfig({ mode: 'disabled', rejectionMessage: '' });
        for (const isCmdLine of [true, false]) {
            const convars = getMutableConvars(isCmdLine);
            expect(convars.every(([, , value]) => value !== '')).toBe(true);
            expect(convars.some(([, name]) => name === 'sv_allowlistInstructions')).toBe(false);
        }
    });

    it('still sends the allowlist instructions when a rejection message is configured', () => {
        stubConfig({ mode: 'discordRoles', rejectionMessage: 'Join our Discord\nthen retry' });
        expect(getMutableConvars(true)).toContainEqual(['+sets', 'sv_allowlistInstructions', 'Join our Discord\\nthen retry']);
        expect(getMutableConvars(false)).toContainEqual(['sets', 'sv_allowlistInstructions', 'Join our Discord\nthen retry']);
    });
});
