const modulename = 'WebServer:ResourcesUpdates';
import { z } from 'zod';
import consoleFactory from '@lib/console';
import { isResourceReplaceable, isValidBackupId, isValidResourceName } from '@lib/resources/files';
import { normalizeReportedResources } from '@lib/resources/report';
import {
    ResourceUpdateError,
    applyResourceUpdate,
    checkResourceUpdates,
    rollbackResource,
    type ReplaceResult,
} from '@lib/resources/updater';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import type {
    ResourceUpdateApplyResp,
    ResourceUpdateFailure,
    ResourceUpdatesCheckResp,
} from '@shared/resourceManagerTypes';
const console = consoleFactory(modulename);

const applyBodySchema = z.object({
    resource: z.string().refine(isValidResourceName),
});
const rollbackBodySchema = z.object({
    resource: z.string().refine(isValidResourceName),
    backupId: z.string().refine(isValidBackupId),
});

const toFailure = (error: unknown, action: string, resource: string): ResourceUpdateFailure => {
    if (error instanceof ResourceUpdateError) {
        if (!['busy', 'check_required', 'invalid_request', 'resource_not_found'].includes(error.code)) {
            console.warn(`Resource ${action} for ${resource} failed (${error.code}): ${error.message}`);
        }
        return error.code;
    }
    console.error(`Resource ${action} for ${resource} failed: ${(error as Error).message}`);
    return 'swap_failed';
};

/**
 * Sends `refresh` so FXServer reads the new manifest. The resource is not restarted:
 * the administrator chooses when, through the existing restart action.
 */
const finishReplace = (ctx: AuthedCtx, result: ReplaceResult, logMessage: string) => {
    ctx.admin.logAction(logMessage);
    txCore.fxRunner.sendCommand('refresh', [], ctx.admin.name);
    return ctx.send<ResourceUpdateApplyResp>({
        success: true,
        resource: result.resource,
        version: result.version,
        backupId: result.backupId,
        pendingRestart: result.pendingRestart,
    });
};

/**
 * POST /resources/updates/check: GitHub release checks (commands.resources).
 * POST /resources/updates/apply: install the checked release (master only).
 * POST /resources/updates/rollback: restore a listed backup (master only).
 */
export default async function ResourcesUpdates(ctx: AuthedCtx) {
    const action = ctx.params.action;

    if (action === 'check') {
        if (!ctx.admin.testPermission('commands.resources', modulename)) {
            return ctx.send<ResourceUpdatesCheckResp>({ success: false, error: 'forbidden' });
        }
        const report = txCore.fxResources.resourceReport;
        if (!txCore.fxRunner.child?.isAlive || !report || !Array.isArray(report.resources)) {
            return ctx.send<ResourceUpdatesCheckResp>({ success: false, error: 'report_unavailable' });
        }
        //Only resources the panel could replace are worth one of GitHub's 60 hourly requests
        const dataPath = txConfig.server.dataPath;
        const candidates = normalizeReportedResources(report.resources)
            .filter((resource) => isResourceReplaceable(resource, dataPath));
        const { checkedAt, results } = await checkResourceUpdates(candidates);
        return ctx.send<ResourceUpdatesCheckResp>({ success: true, checkedAt, results });
    }

    if (action === 'apply') {
        if (!ctx.admin.isMaster) {
            return ctx.send<ResourceUpdateApplyResp>({ success: false, error: 'forbidden' });
        }
        const body = applyBodySchema.safeParse(ctx.request.body);
        if (!body.success) {
            return ctx.send<ResourceUpdateApplyResp>({ success: false, error: 'invalid_request' });
        }
        const { resource } = body.data;
        try {
            const result = await applyResourceUpdate(resource);
            const from = result.previousVersion || 'unknown';
            return finishReplace(
                ctx,
                result,
                `Updated resource "${resource}" from ${from} to ${result.version} (backup ${result.backupId})`,
            );
        } catch (error) {
            return ctx.send<ResourceUpdateApplyResp>({ success: false, error: toFailure(error, 'update', resource) });
        }
    }

    if (action === 'rollback') {
        if (!ctx.admin.isMaster) {
            return ctx.send<ResourceUpdateApplyResp>({ success: false, error: 'forbidden' });
        }
        const body = rollbackBodySchema.safeParse(ctx.request.body);
        if (!body.success) {
            return ctx.send<ResourceUpdateApplyResp>({ success: false, error: 'invalid_request' });
        }
        const { resource, backupId } = body.data;
        try {
            const result = await rollbackResource(resource, backupId);
            return finishReplace(
                ctx,
                result,
                `Rolled back resource "${resource}" to backup ${backupId} (backup of the replaced files ${result.backupId})`,
            );
        } catch (error) {
            return ctx.send<ResourceUpdateApplyResp>({ success: false, error: toFailure(error, 'rollback', resource) });
        }
    }

    return ctx.send<ResourceUpdateApplyResp>({ success: false, error: 'invalid_request' });
}
