import { useState } from 'react';
import type { DatabaseActionType } from '../../../../core/modules/Database/databaseTypes';
import { Button } from '@/components/ui/button';
import type { GenericApiOkResp } from '@shared/genericApiTypes';
import { useAdminPerms } from '@/hooks/auth';
import { CheckCircle2, Loader2, LockKeyhole, RotateCcw, TriangleAlert } from 'lucide-react';
import { useBackendApi } from '@/hooks/fetch';
import type { ApiRevokeActionReqSchema } from '../../../../core/routes/history/actions';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { t } from '@/lib/i18n';

type ActionModifyTabProps = {
    action: DatabaseActionType;
    refreshModalData: () => void;
};

export default function ActionModifyTab({ action, refreshModalData }: ActionModifyTabProps) {
    const [isRevoking, setIsRevoking] = useState(false);
    const { hasPerm } = useAdminPerms();
    const openConfirmDialog = useOpenConfirmDialog();
    const revokeActionApi = useBackendApi<GenericApiOkResp, ApiRevokeActionReqSchema>({
        method: 'POST',
        path: '/history/revokeAction',
    });

    const actionType = action.type === 'ban' ? t('Ban') : t('Warning');
    const isAlreadyRevoked = Boolean(action.revocation.timestamp);
    const hasRevokePerm = hasPerm(action.type === 'warn' ? 'players.warn' : 'players.ban');

    const revoke = () => {
        setIsRevoking(true);
        revokeActionApi({
            data: { actionId: action.id },
            toastLoadingMessage: t('Revoking {type}...', { type: action.type }),
            genericHandler: { successMsg: t('{type} revoked.', { type: actionType }) },
            success: response => {
                if ('success' in response) refreshModalData();
            },
            finally: () => setIsRevoking(false),
        });
    };

    const confirmRevoke = () => openConfirmDialog({
        title: t('Revoke {type}?', { type: actionType.toLocaleLowerCase() }),
        message: action.type === 'ban'
            ? t('The player will be able to reconnect. The record stays in history and the revocation cannot be undone.')
            : t('The warning stays in history and the revocation cannot be undone.'),
        actionLabel: t('Revoke {type}', { type: actionType }),
        confirmBtnVariant: 'destructive',
        onConfirm: revoke,
    });

    if (isAlreadyRevoked) return <div className="grid min-h-72 place-items-center text-center">
        <div className="max-w-md">
            <span className="mx-auto grid size-12 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 className="size-5" />
            </span>
            <h3 className="mt-4 font-medium text-white">{t('This punishment is revoked')}</h3>
            <p className="mt-2 text-sm text-zinc-500">{t('Its history record remains available for auditing.')}</p>
        </div>
    </div>;

    if (!hasRevokePerm) return <div className="grid min-h-72 place-items-center text-center">
        <div className="max-w-md">
            <span className="mx-auto grid size-12 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
                <LockKeyhole className="size-5" />
            </span>
            <h3 className="mt-4 font-medium text-white">{t('Permission required')}</h3>
            <p className="mt-2 text-sm text-zinc-500">{t('Your account cannot revoke this punishment type.')}</p>
        </div>
    </div>;

    return <div className="space-y-5">
        <section className="rounded-2xl border border-red-500/15 bg-red-500/[0.055] p-5">
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-300">
                    <TriangleAlert className="size-5" />
                </span>
                <div>
                    <h3 className="font-medium text-white">{t('Revoke {type}', { type: actionType })}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                        {action.type === 'ban'
                            ? t('Revoking this ban allows the player to reconnect. The punishment remains visible in history.')
                            : t('Revoking this warning marks it inactive while preserving the audit record.')}
                    </p>
                </div>
            </div>
        </section>

        <div className="rounded-xl border border-white/5 bg-white/[0.025] p-4">
            <ul className="space-y-2 text-sm text-zinc-400">
                <li>{t('The player is not notified automatically.')}</li>
                <li>{t('The punishment record remains in History.')}</li>
                <li>{t('The revocation cannot be undone.')}</li>
            </ul>
        </div>

        <Button className="w-full" variant="destructive" disabled={isRevoking} onClick={confirmRevoke}>
            {isRevoking
                ? <><Loader2 className="mr-2 size-4 animate-spin" />{t('Revoking...')}</>
                : <><RotateCcw className="mr-2 size-4" />{t('Revoke {type}', { type: actionType })}</>}
        </Button>
    </div>;
}
