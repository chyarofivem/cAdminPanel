import { z } from 'zod';
import localeMap from '@shared/localeMap';
import type { ApiSelfPreferencesResp } from '@shared/authApiTypes';
import type { AuthedCtx } from '@modules/WebServer/ctxTypes';

const bodySchema = z.object({ locale: z.string() });

export default async function AuthSelfPreferences(ctx: AuthedCtx) {
    const parsed = bodySchema.safeParse(ctx.request.body);
    if (!parsed.success || !(parsed.data.locale in localeMap)) {
        return ctx.send<ApiSelfPreferencesResp>({ error: 'That language is not available.' });
    }
    await txCore.adminStore.setAdminPreferences(ctx.admin.name, { locale: parsed.data.locale });
    ctx.admin.logAction(`Changing personal locale to '${parsed.data.locale}'.`);
    return ctx.send<ApiSelfPreferencesResp>({ success: true, locale: parsed.data.locale });
}
