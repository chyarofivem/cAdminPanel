const modulename = 'WebServer:ResourceMonitorActions';
import { z } from 'zod';
import { fromError } from 'zod-validation-error';
import consoleFactory from '@lib/console';
import resourceMonitorSchema from '@modules/ConfigStore/schema/resourceMonitor';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type { ResourceMonitorActionResp, ResourceMonitorErrorCode } from '@shared/resourceMonitorTypes';
const console = consoleFactory(modulename);


const settingsBodySchema = z.object({
    enabled: resourceMonitorSchema.enabled.validator,
    intervalMinutes: resourceMonitorSchema.intervalMinutes.validator,
    frames: resourceMonitorSchema.frames.validator,
    alertThresholdMs: resourceMonitorSchema.alertThresholdMs.validator,
    alertConsecutive: resourceMonitorSchema.alertConsecutive.validator,
    discordAlerts: resourceMonitorSchema.discordAlerts.validator,
});

const sampleErrorMessages: Record<ResourceMonitorErrorCode, string> = {
    server_offline: 'The server is offline.',
    server_booting: 'The server is still starting.',
    not_configured: 'The server data folder is not configured.',
    already_sampling: 'A sample is already running.',
    command_failed: 'The profiler command could not be sent.',
    file_timeout: 'The profiler file did not appear in time.',
    invalid_trace: 'The profiler file could not be read.',
    no_resource_events: 'The capture held no resource events.',
    unknown: 'The sample could not be started.',
};


/**
 * Handles the resource monitor actions:
 * - sample: starts a capture (requires commands.resources)
 * - settings: saves the monitor settings (requires settings.write)
 */
export default async function ResourceMonitorActions(ctx: AuthedCtx) {
    const sendTypedResp = (data: ResourceMonitorActionResp) => ctx.send(data);
    const action = ctx.params?.action;

    if (action === 'sample') {
        if (!ctx.admin.testPermission('commands.resources', modulename)) {
            return sendTypedResp({ error: 'You don\'t have permission to run this action.', code: 'no_permission' });
        }
        const result = txCore.resourceMonitor.startSample('manual');
        if (result !== true) {
            return sendTypedResp({ error: sampleErrorMessages[result], code: result });
        }
        ctx.admin.logAction('Started a resource monitor sample.');
        return sendTypedResp({ success: true });

    } else if (action === 'settings') {
        if (!ctx.admin.testPermission('settings.write', modulename)) {
            return sendTypedResp({ error: 'You don\'t have permission to change these settings.', code: 'no_permission' });
        }
        const bodyRes = settingsBodySchema.safeParse(ctx.request.body);
        if (!bodyRes.success) {
            return sendTypedResp({
                error: fromError(bodyRes.error, { prefix: null }).message,
                code: 'invalid_request',
            });
        }
        const settings = bodyRes.data;
        try {
            txCore.configStore.saveConfigs({ resourceMonitor: settings }, ctx.admin.name);
        } catch (error) {
            console.warn(`Failed to save the resource monitor settings: ${(error as Error).message}`);
            return sendTypedResp({ error: (error as Error).message, code: 'save_failed' });
        }
        const summary = settings.enabled
            ? `every ${settings.intervalMinutes} min, ${settings.frames} ticks`
            : 'paused';
        ctx.admin.logAction(
            `Changed resource monitor settings: ${summary}, alert at ${settings.alertThresholdMs} ms for ${settings.alertConsecutive} samples, Discord alerts ${settings.discordAlerts ? 'on' : 'off'}.`
        );
        return sendTypedResp({ success: true });

    } else {
        return sendTypedResp({ error: 'Unknown action.', code: 'invalid_request' });
    }
}
