const modulename = 'WebServer:ResourceMonitorData';
import consoleFactory from '@lib/console';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { ResourceMonitorDataResp } from '@shared/resourceMonitorTypes';
const console = consoleFactory(modulename);


/**
 * Returns the resource monitor config, status, latest sample, trimmed history and alerts.
 * Any signed-in admin may read it.
 */
export default async function ResourceMonitorData(ctx: AuthedCtx) {
    const sendTypedResp = (data: ResourceMonitorDataResp) => ctx.send(data);
    try {
        const monitor = txCore.resourceMonitor;
        const cfg = txConfig.resourceMonitor;
        return sendTypedResp({
            serverNow: Date.now(),
            config: {
                enabled: cfg.enabled,
                intervalMinutes: cfg.intervalMinutes,
                frames: cfg.frames,
                alertThresholdMs: cfg.alertThresholdMs,
                alertConsecutive: cfg.alertConsecutive,
                discordAlerts: cfg.discordAlerts,
            },
            status: monitor.getStatus(),
            latest: monitor.getLatestSample(),
            history: monitor.getHistoryPayload(),
            alerts: monitor.getAlerts(),
            discordConfigured: monitor.isDiscordConfigured,
        });
    } catch (error) {
        console.verbose.error(`Failed to build the resource monitor data: ${(error as Error).message}`);
        return sendTypedResp({ error: 'The resource monitor data could not be loaded.' });
    }
}
