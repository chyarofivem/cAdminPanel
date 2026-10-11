import { tsToLocaleDateTimeString } from "@/lib/dateTime";
import { PlayerHistoryItem } from "@shared/playerApiTypes";
import { Badge } from "@/components/ui/badge";
import { ListRow, ListRows } from "@/components/ListRow";
import { useOpenActionModal } from "@/hooks/actionModal";
import { ModalTabInner, ModalTabMessage } from "@/components/modal-tabs";
import { t } from '@/lib/i18n';


type HistoryItemProps = {
    action: PlayerHistoryItem,
    serverTime: number,
    modalOpener: (actionId: string) => void,
}

function HistoryItem({ action, serverTime, modalOpener }: HistoryItemProps) {
    let footerNote;
    let badge: { variant: 'danger' | 'warning' | 'default', label: string } | undefined;
    if (action.type === 'ban') {
        badge = { variant: 'danger', label: t('Ban') };
    } else if (action.type === 'warn') {
        badge = { variant: 'warning', label: t('Warning') };
    }
    if (action.revokedBy) {
        //A revoked action no longer carries its status colour.
        if (badge) badge.variant = 'default';
        const revocationDate = tsToLocaleDateTimeString(action.revokedAt ?? 0, 'medium', 'short');
        footerNote = t('Revoked by {name} on {date}.', { name: action.revokedBy, date: revocationDate });
    } else if (typeof action.exp === 'number') {
        const expirationDate = tsToLocaleDateTimeString(action.exp, 'medium', 'short');
        footerNote = action.exp < serverTime
            ? t('Expired on {date}.', { date: expirationDate })
            : t('Expires on {date}.', { date: expirationDate });
    }

    return (
        <ListRow interactive className="p-0 sm:p-0">
            <button
                type="button"
                onClick={() => { modalOpener(action.id) }}
                className="flex min-h-11 w-full min-w-0 flex-col gap-1 rounded-lg px-4 py-3 text-left"
            >
                <span className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                        <span className="min-w-0 truncate text-dense text-white">{action.author}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <code className="font-mono">{action.id}</code>
                        <span
                            className="cursor-help tabular-nums"
                            title={tsToLocaleDateTimeString(action.ts, 'long', 'long')}
                        >
                            {tsToLocaleDateTimeString(action.ts, 'medium', 'short')}
                        </span>
                    </span>
                </span>
                <span className="block break-words text-sm text-body">{action.reason}</span>
                {footerNote && <span className="block text-xs text-muted-foreground">{footerNote}</span>}
            </button>
        </ListRow>
    );
}


type PlayerHistoryTabProps = {
    actionHistory: PlayerHistoryItem[],
    serverTime: number,
    refreshModalData: () => void,
}

export default function PlayerHistoryTab({ actionHistory, serverTime, refreshModalData }: PlayerHistoryTabProps) {
    const openActionModal = useOpenActionModal();

    if (!actionHistory.length) {
        return <ModalTabMessage className="text-sm">
            {t('No bans or warnings found.')}
        </ModalTabMessage>;
    }

    const doOpenActionModal = (actionId: string) => {
        openActionModal(actionId);
    }

    const reversedActionHistory = [...actionHistory].reverse();
    return (
        <ModalTabInner>
            <ListRows>
                {reversedActionHistory.map((action) => (
                    <HistoryItem
                        key={action.id}
                        action={action}
                        serverTime={serverTime}
                        modalOpener={doOpenActionModal}
                    />
                ))}
            </ListRows>
        </ModalTabInner>
    );
}
