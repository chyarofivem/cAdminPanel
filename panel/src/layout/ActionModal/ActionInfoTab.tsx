import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CopyRow from '@/components/CopyRow';
import { msToDuration } from '@/lib/dateTime';
import type { DatabaseActionType } from '../../../../core/modules/Database/databaseTypes';
import { useOpenPlayerModal } from '@/hooks/playerModal';
import DateTimeCorrected from '@/components/DateTimeCorrected';
import { t } from '@/lib/i18n';

type ActionInfoTabProps = {
    action: DatabaseActionType;
    serverTime: number;
    tsFetch: number;
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="min-w-0">
        <dt className="text-dense text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-sm text-white">{children}</dd>
    </div>;
}

export default function ActionInfoTab({ action, serverTime, tsFetch }: ActionInfoTabProps) {
    const openPlayerModal = useOpenPlayerModal();
    const targetLicenses = [...new Set(action.ids
        .filter(id => id.startsWith('license:'))
        .map(id => id.slice('license:'.length)))];
    const linkedPlayer = targetLicenses.length === 1 ? targetLicenses[0] : null;

    let expiration: React.ReactNode;
    if (action.type === 'ban') {
        if (action.expiration === false) {
            expiration = t('Permanent');
        } else if (action.expiration > serverTime) {
            const distance = msToDuration((action.expiration - serverTime) * 1000, {
                units: ['mo', 'w', 'd', 'h', 'm'],
            });
            expiration = t('In {duration}', { duration: distance });
        } else {
            expiration = <DateTimeCorrected
                className="cursor-help"
                serverTime={serverTime}
                tsObject={action.expiration}
                tsFetch={tsFetch}
            />;
        }
    }

    const revoked = action.revocation.timestamp
        ? <span>
            {t('By {admin} on', { admin: action.revocation.author ?? t('Unknown admin') })}{' '}
            <DateTimeCorrected
                isDateOnly
                className="cursor-help"
                serverTime={serverTime}
                tsObject={action.revocation.timestamp}
                tsFetch={tsFetch}
            />
        </span>
        : <span className="text-muted-foreground">{t('Not revoked')}</span>;

    return <div className="flex flex-col gap-6">
        <section>
            <h3 className="text-dense text-muted-foreground">{t('Reason')}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white">{action.reason}</p>
        </section>

        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label={t('Issued')}>
                <DateTimeCorrected
                    className="cursor-help"
                    serverTime={serverTime}
                    tsObject={action.timestamp}
                    tsFetch={tsFetch}
                />
            </Detail>
            <Detail label={t('Administrator')}>{action.author}</Detail>
            {action.type === 'ban' && <Detail label={t('Expiration')}>{expiration}</Detail>}
            {action.type === 'warn' && <Detail label={t('Acknowledgement')}>
                {action.acked
                    ? <Badge variant="success">{t('Accepted')}</Badge>
                    : <Badge variant="warning">{t('Pending')}</Badge>}
            </Detail>}
            <Detail label={t('Revocation')}>{revoked}</Detail>
            <Detail label={t('Player')}>
                <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{action.playerName || t('Unknown player')}</span>
                    <Button
                        variant="secondary"
                        size="xs"
                        className="shrink-0"
                        disabled={!linkedPlayer}
                        onClick={() => {
                            if (linkedPlayer) openPlayerModal({ license: linkedPlayer });
                        }}
                    >
                        {t('View')}
                    </Button>
                </div>
            </Detail>
        </dl>

        <CopyRow label={t('Action ID')} value={action.id} />
    </div>;
}
