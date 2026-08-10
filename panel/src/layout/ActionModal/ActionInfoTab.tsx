import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { msToDuration } from '@/lib/dateTime';
import type { DatabaseActionType } from '../../../../core/modules/Database/databaseTypes';
import { useOpenPlayerModal } from '@/hooks/playerModal';
import DateTimeCorrected from '@/components/DateTimeCorrected';
import { CalendarClock, Clock3, ShieldCheck, UserRound, UserRoundCog } from 'lucide-react';
import { t } from '@/lib/i18n';

type ActionInfoTabProps = {
    action: DatabaseActionType;
    serverTime: number;
    tsFetch: number;
};

function DetailCard({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
    return <div className="rounded-xl border border-white/5 bg-white/[0.025] p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-600">
            <span className="[&_svg]:size-3.5">{icon}</span>{label}
        </div>
        <div className="mt-2 text-sm text-zinc-200">{children}</div>
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
            expiration = <span className="text-red-300">{t('Permanent')}</span>;
        } else if (action.expiration > serverTime) {
            const distance = msToDuration((action.expiration - serverTime) * 1000, {
                units: ['mo', 'w', 'd', 'h', 'm'],
            });
            expiration = <span className="text-amber-300">{t('In {duration}', { duration: distance })}</span>;
        } else {
            expiration = <DateTimeCorrected
                className="cursor-help text-zinc-400"
                serverTime={serverTime}
                tsObject={action.expiration}
                tsFetch={tsFetch}
            />;
        }
    }

    const revoked = action.revocation.timestamp
        ? <span className="text-amber-300">
            {t('By {admin} on', { admin: action.revocation.author ?? t('Unknown admin') })}{' '}
            <DateTimeCorrected
                isDateOnly
                className="cursor-help"
                serverTime={serverTime}
                tsObject={action.revocation.timestamp}
                tsFetch={tsFetch}
            />
        </span>
        : <span className="text-emerald-300">{t('Active')}</span>;

    return <div className="space-y-5">
        <section className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-widest text-zinc-500">{t('Reason')}</p>
                <Badge variant="outline" className="border-white/10 bg-black/20 text-[10px] uppercase text-zinc-400">
                    {action.type === 'ban' ? t('Ban') : t('Warning')}
                </Badge>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{action.reason}</p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
            <DetailCard label={t('Issued')} icon={<CalendarClock />}>
                <DateTimeCorrected
                    className="cursor-help"
                    serverTime={serverTime}
                    tsObject={action.timestamp}
                    tsFetch={tsFetch}
                />
            </DetailCard>
            <DetailCard label={t('Administrator')} icon={<UserRoundCog />}>{action.author}</DetailCard>
            {action.type === 'ban' && <DetailCard label={t('Expiration')} icon={<Clock3 />}>{expiration}</DetailCard>}
            {action.type === 'warn' && <DetailCard label={t('Acknowledgement')} icon={<ShieldCheck />}>
                {action.acked
                    ? <span className="text-emerald-300">{t('Accepted')}</span>
                    : <span className="text-amber-300">{t('Pending')}</span>}
            </DetailCard>}
            <DetailCard label={t('Revocation')} icon={<ShieldCheck />}>{revoked}</DetailCard>
            <DetailCard label={t('Player')} icon={<UserRound />}>
                <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{action.playerName || t('Unknown player')}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2.5 text-xs"
                        disabled={!linkedPlayer}
                        onClick={() => {
                            if (linkedPlayer) openPlayerModal({ license: linkedPlayer });
                        }}
                    >
                        {t('View')}
                    </Button>
                </div>
            </DetailCard>
        </div>
    </div>;
}
