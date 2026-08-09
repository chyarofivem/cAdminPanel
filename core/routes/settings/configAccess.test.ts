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

    test('omits FXServer values while retaining the restart schedule for non-master accounts', () => {
        const input: PartialTxConfigs = {
            server: { dataPath: 'C:/private/server', startupArgs: ['+set', 'token', 'secret'] },
            restarter: { schedule: ['06:00'], resourceStartingTolerance: 120, bootGracePeriod: 60 },
            cadmin: { apiSecret: 'cadmin-secret' },
            chyaro: { apiKey: 'chyaro-secret' },
        };

        const visible = getVisibleSettingsConfig(input, { isMaster: false, canWrite: true });

        expect(visible.server).toBeUndefined();
        expect(visible.restarter).toEqual({ schedule: ['06:00'] });
        expect(visible.cadmin?.apiSecret).toBe('[redacted]');
        expect(visible.chyaro?.apiKey).toBe('[redacted]');
        expect(input.server?.dataPath).toBe('C:/private/server');
    });
});
