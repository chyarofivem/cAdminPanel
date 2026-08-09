import { z } from 'zod';
import type { InitializedCtx } from '@modules/WebServer/ctxTypes';
import { testChyaroConnection } from '@lib/chyaroApi';

const pinSchema = z.string().trim().min(1).max(100);
const setupSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.enum(['test', 'save']),
        apiUrl: z.string().url().max(300).transform(value => value.replace(/\/+$/, '')),
        apiKey: z.string().min(1).max(500),
        panelUrl: z.string().url().max(300).refine(
            value => new URL(value).protocol === 'https:',
            'Public panel URL must use HTTPS.',
        ).transform(value => value.replace(/\/+$/, '')),
        bootstrapPin: pinSchema,
    }),
    z.object({
        action: z.literal('authorize'),
        bootstrapPin: pinSchema,
    }),
]);

export const CHYARO_BOOTSTRAP_TTL_MS = 10 * 60 * 1000;
export const hasValidChyaroBootstrap = (
    session: { tmpChyaroBootstrapExpiresAt?: number } | undefined,
    now = Date.now(),
) => typeof session?.tmpChyaroBootstrapExpiresAt === 'number'
    && session.tmpChyaroBootstrapExpiresAt > now;

export default async function ChyaroSetup(ctx: InitializedCtx) {
    if (txCore.adminStore.hasAdmins()) return ctx.utils.error(403, 'Bootstrap is already configured.');
    const parsed = setupSchema.safeParse(ctx.request.body);
    if (!parsed.success) return ctx.send({ success: false, message: 'Enter a valid API URL, API key, and HTTPS panel URL.' });
    if (!txCore.adminStore.validateAddMasterPin(parsed.data.bootstrapPin)) {
        ctx.status = 403;
        return ctx.send({ success: false, message: 'The bootstrap PIN is incorrect.' });
    }

    if (parsed.data.action === 'authorize') {
        if (!txConfig.chyaro.apiKey) return ctx.send({ success: false, message: 'Configure chyarologin first.' });
        ctx.sessTools.set({ tmpChyaroBootstrapExpiresAt: Date.now() + CHYARO_BOOTSTRAP_TTL_MS });
        return ctx.send({ success: true, authorized: true, saved: false });
    }
    if (txConfig.chyaro.apiKey && txConfig.chyaro.panelUrl) {
        return ctx.utils.error(403, 'Bootstrap is already configured.');
    }

    try {
        const identities = await testChyaroConnection(parsed.data);
        if (parsed.data.action === 'save') {
            txCore.configStore.saveConfigs({
                chyaro: {
                    apiUrl: parsed.data.apiUrl,
                    apiKey: parsed.data.apiKey,
                    panelUrl: parsed.data.panelUrl,
                },
            }, 'chyarologin bootstrap');
            ctx.sessTools.set({ tmpChyaroBootstrapExpiresAt: Date.now() + CHYARO_BOOTSTRAP_TTL_MS });
        }
        return ctx.send({
            success: true,
            identities,
            saved: parsed.data.action === 'save',
            authorized: parsed.data.action === 'save',
        });
    } catch (error) {
        return ctx.send({ success: false, message: (error as Error).message });
    }
}
