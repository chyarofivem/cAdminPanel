import { describe, expect, test } from 'vitest';
import type { PartialTxConfigs } from '@modules/ConfigStore/schema';
import { getVisibleSettingsConfig, hasMasterOnlyConfigMutation } from './configAccess';

describe('settings config access', () => {
    test('allows delegated writers to update the restart schedule', () => {
        expect(hasMasterOnlyConfigMutation({ restarter: { schedule: ['06:00'] } }, [])).toBe(false);
        expect(hasMasterOnlyConfigMutation({}, ['restarter.schedule'])).toBe(false);
    });

    test('detects FXServer mutations sent through another settings card', () => {
        expect(hasMasterOnlyConfigMutation({ server: { quiet: true } }, [])).toBe(true);
        expect(hasMasterOnlyConfigMutation({ restarter: { resourceStartingTolerance: 120 } }, [])).toBe(true);
        expect(hasMasterOnlyConfigMutation({}, ['server.cfgPath'])).toBe(true);
        expect(hasMasterOnlyConfigMutation({}, ['restarter.bootGracePeriod'])).toBe(true);
    });

    test('detects direct and reset Discord bot token mutations', () => {
        expect(hasMasterOnlyConfigMutation({ discordBot: { token: 'replacement-token' } }, [])).toBe(true);
        expect(hasMasterOnlyConfigMutation({}, ['discordBot.token'])).toBe(true);
    });

    test('allows delegated writers to update non-token Discord bot settings', () => {
        expect(hasMasterOnlyConfigMutation({
            discordBot: {
                enabled: true,
                guild: '123456789012345678',
                warningsChannel: '234567890123456789',
                embedJson: '{}',
                embedConfigJson: '{}',
            },
        }, [])).toBe(false);
        expect(hasMasterOnlyConfigMutation({}, ['discordBot.guild'])).toBe(false);
    });

    test('omits FXServer values while retaining the restart schedule for non-master accounts', () => {
        const input: PartialTxConfigs = {
            server: { dataPath: 'C:/private/server', startupArgs: ['+set', 'token', 'secret'] },
            restarter: { schedule: ['06:00'], resourceStartingTolerance: 120, bootGracePeriod: 60 },
            cadmin: { apiSecret: 'cadmin-secret' },
        };

        const visible = getVisibleSettingsConfig(input, { isMaster: false, canWrite: true });

        expect(visible.server).toBeUndefined();
        expect(visible.restarter).toEqual({ schedule: ['06:00'] });
        expect(visible.cadmin?.apiSecret).toBe('[redacted]');
        expect(input.server?.dataPath).toBe('C:/private/server');
    });

    test('redacts the Discord bot token from non-master settings writers', () => {
        const input: PartialTxConfigs = {
            discordBot: {
                enabled: true,
                token: 'discord-secret',
                guild: '123456789012345678',
            },
        };

        const visible = getVisibleSettingsConfig(input, { isMaster: false, canWrite: true });

        expect(visible.discordBot).toEqual({
            enabled: true,
            token: '[redacted]',
            guild: '123456789012345678',
        });
        expect(input.discordBot?.token).toBe('discord-secret');
    });

    test('keeps the Discord bot token visible to the master', () => {
        const visible = getVisibleSettingsConfig({
            discordBot: { token: 'discord-secret' },
        }, { isMaster: true, canWrite: true });

        expect(visible.discordBot?.token).toBe('discord-secret');
    });
});
