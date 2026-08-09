import { KickAllIcon } from '@/components/KickIcons';
import { fxRunnerStateAtom, txConfigStateAtom } from '@/hooks/status';
import { cn } from '@/lib/utils';
import { useAtomValue } from 'jotai';
import { MegaphoneIcon, PowerIcon, PowerOffIcon, RotateCcwIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOpenConfirmDialog, useOpenPromptDialog } from '@/hooks/dialogs';
import { ApiTimeout, useBackendApi } from '@/hooks/fetch';
import { useCloseAllSheets } from '@/hooks/sheets';
import { useAdminPerms } from '@/hooks/auth';
import { TxConfigState } from '@shared/enums';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';


const controlButtonClass = 'h-9 w-full gap-2 px-2 text-xs shadow-none';

export default function ServerControls() {
    const txConfigState = useAtomValue(txConfigStateAtom);
    const fxRunnerState = useAtomValue(fxRunnerStateAtom);
    const openConfirmDialog = useOpenConfirmDialog();
    const openPromptDialog = useOpenPromptDialog();
    const closeAllSheets = useCloseAllSheets();
    const { hasPerm } = useAdminPerms();
    const fxsControlApi = useBackendApi({
        method: 'POST',
        path: '/fxserver/controls'
    });
    const fxsCommandsApi = useBackendApi({
        method: 'POST',
        path: '/fxserver/commands'
    });

    const handleServerControl = (action: 'start' | 'stop' | 'restart') => {
        const messageMap = {
            start: 'Starting server',
            stop: 'Stopping server',
            restart: 'Restarting server',
        }
        const toastLoadingMessage = t('{action}...', { action: t(messageMap[action]) });
        const callApi = () => {
            closeAllSheets();
            fxsControlApi({
                data: { action },
                toastLoadingMessage,
                timeout: ApiTimeout.LONG,
            });
        }
        if (action === 'start') {
            callApi();
        } else {
            openConfirmDialog({
                title: t(messageMap[action]),
                message: t(action === 'stop'
                    ? 'Are you sure you want to stop the server?'
                    : 'Are you sure you want to restart the server?'),
                onConfirm: callApi,
            });
        }
    }
    const handleStartStop = () => {
        handleServerControl(fxRunnerState.isIdle ? 'start' : 'stop');
    }
    const handleRestart = () => {
        if (!fxRunnerState.isChildAlive) return;
        handleServerControl('restart');
    }

    const handleAnnounce = () => {
        if (!fxRunnerState.isChildAlive) return;
        openPromptDialog({
            title: t('Send Announcement'),
            message: t('Type the message to be broadcasted to all players.'),
            placeholder: t('announcement message'),
            submitLabel: t('Send'),
            required: true,
            isMultiline: true,
            onSubmit: (input) => {
                closeAllSheets();
                fxsCommandsApi({
                    data: { action: 'admin_broadcast', parameter: input },
                    toastLoadingMessage: t('Sending announcement...'),
                });
            }
        });
    }

    const handleKickAll = () => {
        if (!fxRunnerState.isChildAlive) return;
        openPromptDialog({
            title: t('Kick All Players'),
            message: t('Type the kick reason or leave it blank (press enter)'),
            placeholder: t('kick reason'),
            submitLabel: t('Send'),
            onSubmit: (input) => {
                closeAllSheets();
                fxsCommandsApi({
                    data: { action: 'kick_all', parameter: input },
                    toastLoadingMessage: t('Kicking players...'),
                });
            }
        });
    }

    const hasControlPerms = hasPerm('control.server');
    const hasAnnouncementPerm = hasPerm('announcement');

    if (txConfigState !== TxConfigState.Ready) {
        return (
            <div className='w-full h-8 text-center tracking-wider font-light opacity-75'>
                {t('Server not configured.')}
            </div>
        )
    }
    return (
        <div className="grid grid-cols-2 gap-2" aria-label={t('Server controls')}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {fxRunnerState.isIdle ? (
                        <div className="relative">
                            <div className='absolute inset-0 bg-success/50 animate-pulse rounded-lg blur-md'></div>
                            <Button
                                onClick={handleStartStop}
                                variant="success"
                                className={cn(controlButtonClass, 'relative')}
                                disabled={!hasControlPerms}
                            >
                                <PowerIcon className='size-4' /> {t('Start')}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={handleStartStop}
                            variant="destructive"
                            className={controlButtonClass}
                            disabled={!hasControlPerms}
                        >
                            <PowerOffIcon className='size-4' /> {t('Stop')}
                        </Button>
                    )}
                </TooltipTrigger>
                <TooltipContent className={cn(!hasControlPerms && 'text-destructive-inline text-center')}>
                    {hasControlPerms ? (
                        <p>{fxRunnerState.isIdle ? t('Start the server! 🚀') : t('Stop the server')}</p>
                    ) : (
                        <p>{t('You do not have permission to control the server.')}</p>
                    )}
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={handleRestart}
                        variant="outline"
                        className={controlButtonClass}
                        disabled={!hasControlPerms || !fxRunnerState.isChildAlive}
                    >
                        <RotateCcwIcon className='size-4' /> {t('Restart')}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className={cn(!hasControlPerms && 'text-destructive-inline text-center')}>
                    {hasControlPerms ? (
                        <p>{t('Restart Server')}</p>
                    ) : (
                        <p>{t('You do not have permission to control the server.')}</p>
                    )}
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={handleKickAll}
                        variant="outline"
                        className={controlButtonClass}
                        disabled={!hasControlPerms || !fxRunnerState.isChildAlive}
                    >
                        <KickAllIcon style={{ height: '1.25rem', width: '1.5rem', fill: 'currentcolor' }} />
                        {t('Kick All')}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className={cn(!hasControlPerms && 'text-destructive-inline text-center')}>
                    {hasControlPerms ? (
                        <p>{t('Kick All Players')}</p>
                    ) : (
                        <p>{t('You do not have permission to control the server.')}</p>
                    )}
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        onClick={handleAnnounce}
                        variant="outline"
                        className={controlButtonClass}
                        disabled={!hasAnnouncementPerm || !fxRunnerState.isChildAlive}
                    >
                        <MegaphoneIcon className='size-4' /> {t('Announce')}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className={cn(!hasAnnouncementPerm && 'text-destructive-inline text-center')}>
                    {hasAnnouncementPerm ? (
                        <p>{t('Send Announcement')}</p>
                    ) : (
                        <p>{t('You do not have permission to send an announcement.')}</p>
                    )}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}
