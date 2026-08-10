import { z } from 'zod';
import localeMap from '@shared/localeMap';
import type { ApiSelfPreferencesResp } from '@shared/authApiTypes';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { ACCENTS, type AccentId } from '@lib/theme';

const accentIds = Object.keys(ACCENTS) as [AccentId, ...AccentId[]];
const bodySchema = z.object({
    locale: z.string().optional(),
    accent: z.enum(accentIds).optional(),
}).strict().refine(value => value.locale !== undefined || value.accent !== undefined);

export default async function AuthSelfPreferences(ctx: AuthedCtx) {
    const parsed = bodySchema.safeParse(ctx.request.body);
    if (!parsed.success) {
        return ctx.send<ApiSelfPreferencesResp>({ error: 'Choose a valid account preference.' });
    }
    if (parsed.data.locale !== undefined
        && !Object.prototype.hasOwnProperty.call(localeMap, parsed.data.locale)) {
        return ctx.send<ApiSelfPreferencesResp>({ error: 'That language is not available.' });
    }
    await txCore.adminStore.setAdminPreferences(ctx.admin.name, parsed.data);
    const changed = [
        parsed.data.locale && `locale to '${parsed.data.locale}'`,
        parsed.data.accent && `accent to '${parsed.data.accent}'`,
    ].filter(Boolean).join(' and ');
    ctx.admin.logAction(`Changing personal ${changed}.`);

    const locale = parsed.data.locale ?? ctx.admin.locale;
    const accent = parsed.data.accent ?? ctx.admin.accent;
    return ctx.send<ApiSelfPreferencesResp>({
        success: true,
        locale,
        accent,
        accentColor: accent ? ACCENTS[accent].hex : undefined,
    });
}
