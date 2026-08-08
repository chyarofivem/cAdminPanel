import { KickAllIcon } from '@/components/KickIcons';
import { fxRunnerStateAtom, txConfigStateAtom } from '@/hooks/status';
import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';
import { useAtomValue } from 'jotai';
import { MegaphoneIcon, PowerIcon, PowerOffIcon, RotateCcwIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOpenConfirmDialog, useOpenPromptDialog } from '@/hooks/dialogs';
import { ApiTimeout, useBackendApi } from '@/hooks/fetch';
import { useCloseAllSheets } from '@/hooks/sheets';
import { useAdminPerms } from '@/hooks/auth';
import { TxConfigState } from '@shared/enums';
import { t } from '@/lib/i18n';


const controlButtonsVariants = cva(
    `h-10 sm:h-8 rounded-md transition-colors
    flex flex-grow items-center justify-center flex-shrink-0
    border bg-muted shadow-sm

    focus:outline-none disabled:opacity-50 ring-offset-background  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`,
    {
        variants: {
            type: {
                default: "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                destructive: "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive",
                warning: "hover:bg-warning hover:text-warning-foreground hover:border-warning",
                success: "hover:bg-success hover:text-success-foreground hover:border-success",
                info: "hover:bg-info hover:text-info-foreground hover:border-info",
            },
        },
        defaultVariants: {
            type: "default",
        },
    }
);

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
        <div className="flex flex-row justify-between gap-2">
            <Tooltip>
                <TooltipTrigger asChild>
                    {fxRunnerState.isIdle ? (
                        <div className="relative flex flex-grow inset-0">
                            <div className='absolute inset-0 bg-success animate-pulse rounded blur-sm'></div>
                            <button
                                onClick={handleStartStop}
                                className={cn(controlButtonsVariants({ type: 'success' }), 'relative')}
                                disabled={!hasControlPerms}
                            >
                                <PowerIcon className='h-5' />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleStartStop}
                            className={controlButtonsVariants({ type: 'destructive' })}
                            disabled={!hasControlPerms}
                        >
                            <PowerOffIcon className='h-5' />
                        </button>
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
                    <button
                        onClick={handleRestart}
                        className={cn(controlButtonsVariants({ type: 'warning' }))}
                        disabled={!hasControlPerms || !fxRunnerState.isChildAlive}
                    >
                        <RotateCcwIcon className='h-5' />
                    </button>
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
                    <button
                        onClick={handleKickAll}
                        className={controlButtonsVariants()}
                        disabled={!hasControlPerms || !fxRunnerState.isChildAlive}
                    >
                        <KickAllIcon style={{ height: '1.25rem', width: '1.5rem', fill: 'currentcolor' }} />
                    </button>
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
                    <button
                        onClick={handleAnnounce}
                        className={controlButtonsVariants()}
                        disabled={!hasAnnouncementPerm || !fxRunnerState.isChildAlive}
                    >
                        <MegaphoneIcon className='h-5' />
                    </button>
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
