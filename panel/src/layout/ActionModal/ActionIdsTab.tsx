import type { DatabaseActionType } from '../../../../core/modules/Database/databaseTypes';
import MultiIdsList from '@/components/MultiIdsList';
import { t } from '@/lib/i18n';

export default function ActionIdsTab({ action }: { action: DatabaseActionType }) {
    const hwids = 'hwids' in action && action.hwids ? action.hwids : [];

    return <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
            {t('These identifiers were recorded when the punishment was issued. Use compare to check another connection.')}
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
            <MultiIdsList type="id" src="action" idsOffline={action.ids} />
            <MultiIdsList type="hwid" src="action" idsOffline={hwids} />
        </div>
    </div>;
}
