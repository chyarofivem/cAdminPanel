import { cloneDeep } from 'lodash-es';
import { redactStartupSecrets } from '@lib/misc';
import type { PartialTxConfigs } from '@modules/ConfigStore/schema';

type SettingsAccess = {
    isMaster: boolean;
    canWrite: boolean;
};

/**
 * FXServer configuration is master-only. The restart schedule is intentionally
 * kept outside that boundary so delegated settings writers can maintain it.
 */
export function hasMasterOnlyConfigMutation(changes: PartialTxConfigs, resetKeys: string[]) {
    if (changes.server && Object.keys(changes.server).length > 0) return true;
    if (
        changes.restarter
        && Object.keys(changes.restarter).some(key => key !== 'schedule')
    ) {
        return true;
    }
    if (
        changes.discordBot
        && Object.prototype.hasOwnProperty.call(changes.discordBot, 'token')
    ) {
        return true;
    }

    return resetKeys.some((configPath) => {
        const [scope, key] = configPath.split('.');
        return scope === 'server'
            || (scope === 'restarter' && key !== 'schedule')
            || (scope === 'discordBot' && key === 'token');
    });
}

/**
 * Returns the settings payload an administrator may inspect. Always clone so
 * redaction never mutates ConfigStore state or its shared schema defaults.
 */
export function getVisibleSettingsConfig(
    config: PartialTxConfigs,
    access: SettingsAccess,
): PartialTxConfigs {
    const visible = cloneDeep(config) as any;

    if (!access.canWrite) {
        if (visible.server?.startupArgs) {
            visible.server.startupArgs = redactStartupSecrets(visible.server.startupArgs);
        }
    }

    if (!access.isMaster) {
        if (visible.discordBot?.token) {
            visible.discordBot.token = '[redacted by txAdmin]';
        }
        delete visible.server;
        if (visible.restarter) {
            visible.restarter = visible.restarter.schedule === undefined
                ? {}
                : { schedule: visible.restarter.schedule };
        }
        if (visible.chyaro?.apiKey) visible.chyaro.apiKey = '[redacted]';
        if (visible.cadmin?.apiSecret) visible.cadmin.apiSecret = '[redacted]';
    }

    return visible;
}
