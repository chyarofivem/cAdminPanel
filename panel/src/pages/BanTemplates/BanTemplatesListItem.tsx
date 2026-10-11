import { banDurationToString } from "@/lib/utils";
import { BanDurationType } from "@shared/otherTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";


type BanTemplatesListItemProps = {
    id: string;
    reason: string;
    duration: BanDurationType;
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
    disabled: boolean;
}

export default function BanTemplatesListItem({ id, reason, duration, onEdit, onRemove, disabled }: BanTemplatesListItemProps) {
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="line-clamp-5 min-w-0 break-words text-sm text-white md:line-clamp-3">
                    {reason}
                </span>
                <Badge variant={duration === 'permanent' ? 'danger' : 'default'} className="shrink-0 select-none">
                    {duration === 'permanent' ? t('Permanent') : banDurationToString(duration)}
                </Badge>
            </div>
            <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => onEdit(id)} disabled={disabled}>
                    {t('Edit')}
                </Button>
                <Button size="sm" variant="outline-destructive" onClick={() => onRemove(id)} disabled={disabled}>
                    {t('Remove')}
                </Button>
            </div>
        </div>
    )
}
