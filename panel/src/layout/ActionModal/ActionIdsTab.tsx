import type { DatabaseActionType } from '../../../../core/modules/Database/databaseTypes';
import MultiIdsList from '@/components/MultiIdsList';
import { Fingerprint } from 'lucide-react';
import { t } from '@/lib/i18n';

export default function ActionIdsTab({ action }: { action: DatabaseActionType }) {
    const hwids = 'hwids' in action && action.hwids ? action.hwids : [];

    return <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-4 text-sm text-zinc-400">
            <Fingerprint className="mt-0.5 size-4 shrink-0 text-brand-400" />
            <p>{t('These identifiers were recorded when the punishment was issued. Use compare to check another connection.')}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 [&>div]:rounded-xl [&>div]:border [&>div]:border-white/5 [&>div]:bg-white/[0.02] [&>div]:p-4">
            <MultiIdsList type="id" src="action" idsOffline={action.ids} />
            <MultiIdsList type="hwid" src="action" idsOffline={hwids} />
        </div>
    </div>;
}
