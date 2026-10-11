import { useState } from 'react';
import type { DatabaseActionType } from '../../../../core/modules/Database/databaseTypes';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { GenericApiOkResp } from '@shared/genericApiTypes';
import { useAdminPerms } from '@/hooks/auth';
import { useBackendApi } from '@/hooks/fetch';
import type { ApiRevokeActionReqSchema } from '../../../../core/routes/history/actions';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { t } from '@/lib/i18n';

type ActionModifyTabProps = {
    action: DatabaseActionType;
    refreshModalData: () => void;
};

function TabNotice({ title, message }: { title: string; message: string }) {
    return <div role="status" className="flex min-h-72 flex-col items-center justify-center text-center">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
    </div>;
}

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

    if (isAlreadyRevoked) return <TabNotice
        title={t('This punishment is revoked')}
        message={t('Its history record remains available for auditing.')}
    />;

    if (!hasRevokePerm) return <TabNotice
        title={t('Permission required')}
        message={t('Your account cannot revoke this punishment type.')}
    />;

    return <div className="flex flex-col gap-6">
        <Alert variant="warning">
            <AlertTitle>{t('Revoke {type}', { type: actionType })}</AlertTitle>
            <AlertDescription>
                {action.type === 'ban'
                    ? t('Revoking this ban allows the player to reconnect. The punishment remains visible in history.')
                    : t('Revoking this warning marks it inactive while preserving the audit record.')}
            </AlertDescription>
        </Alert>

        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-body">
            <li>{t('The player is not notified automatically.')}</li>
            <li>{t('The punishment record remains in History.')}</li>
            <li>{t('The revocation cannot be undone.')}</li>
        </ul>

        <div>
            <Button variant="outline-destructive" disabled={isRevoking} onClick={confirmRevoke}>
                {isRevoking ? t('Revoking...') : t('Revoke {type}', { type: actionType })}
            </Button>
        </div>
    </div>;
}
