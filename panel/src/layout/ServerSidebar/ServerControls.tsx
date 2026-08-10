import { txToast } from '@/components/TxToaster';
import { fxRunnerStateAtom, txConfigStateAtom, useGlobalStatus } from '@/hooks/status';
import { cn } from '@/lib/utils';
import { useAtomValue } from 'jotai';
import { Clock3Icon, MegaphoneIcon, PlayCircleIcon, PowerIcon, PowerOffIcon, RotateCcwIcon, XCircleIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOpenConfirmDialog, useOpenPromptDialog } from '@/hooks/dialogs';
import { ApiTimeout, useBackendApi } from '@/hooks/fetch';
import { useCloseAllSheets } from '@/hooks/sheets';
import { useAdminPerms } from '@/hooks/auth';
import { TxConfigState } from '@shared/enums';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { restartSchedulePromptProps } from './restartScheduleUtils';
import { validateRestartSchedule } from './restartScheduleValidation';


const controlButtonClass = 'h-9 w-full gap-2 px-2 text-xs shadow-none';

export default function ServerControls() {
    const txConfigState = useAtomValue(txConfigStateAtom);
    const fxRunnerState = useAtomValue(fxRunnerStateAtom);
    const globalStatus = useGlobalStatus();
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
    const schedulerApi = useBackendApi({
        method: 'POST',
        path: '/fxserver/schedule'
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

    const scheduler = globalStatus?.scheduler;
    const hasScheduledRestart = typeof scheduler?.nextRelativeMs === 'number';
    const scheduledRestartIsSkipped = hasScheduledRestart && scheduler?.nextSkip === true;

    const submitRestartSchedule = (input: string) => {
        const normalized = input.trim();
        if (normalized.includes(',')) {
            txToast.error({
                title: t('Invalid scheduled restart time.'),
                msg: t('Multiple restart times can only be configured in Settings. This field schedules only the next temporary restart.'),
            }, { duration: 10000 });
            return;
        }
        if (!validateRestartSchedule(normalized)) {
            txToast.error(t('Invalid schedule time: {input}', { input: normalized }));
            return;
        }
        closeAllSheets();
        schedulerApi({
            data: { action: 'setNextTempSchedule', parameter: normalized },
            toastLoadingMessage: t('Scheduling server restart...'),
        });
    };

    const handleRestartSchedule = () => {
        if (scheduledRestartIsSkipped) {
            closeAllSheets();
            schedulerApi({
                data: { action: 'setNextSkip', parameter: false },
                toastLoadingMessage: t('Enabling next server restart...'),
            });
            return;
        }
        if (hasScheduledRestart) {
            openConfirmDialog({
                title: t('Cancel Restart'),
                message: t('Are you sure you want to cancel the next scheduled restart?'),
                actionLabel: t('Cancel Restart'),
                confirmBtnVariant: 'destructive',
                onConfirm: () => {
                    closeAllSheets();
                    schedulerApi({
                        data: { action: 'setNextSkip', parameter: true },
                        toastLoadingMessage: t('Cancelling next server restart...'),
                    });
                },
            });
            return;
        }
        openPromptDialog({
            ...restartSchedulePromptProps(),
            submitLabel: t('Schedule'),
            onSubmit: submitRestartSchedule,
        });
    };

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
                        onClick={handleRestartSchedule}
                        variant={hasScheduledRestart && !scheduledRestartIsSkipped ? 'outline-destructive' : 'outline'}
                        className={controlButtonClass}
                        disabled={!hasControlPerms}
                    >
                        {scheduledRestartIsSkipped
                            ? <PlayCircleIcon className='size-4' />
                            : hasScheduledRestart
                                ? <XCircleIcon className='size-4' />
                                : <Clock3Icon className='size-4' />}
                        {scheduledRestartIsSkipped
                            ? t('Enable')
                            : hasScheduledRestart
                                ? t('Cancel')
                                : t('Schedule')}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className={cn(!hasControlPerms && 'text-destructive-inline text-center')}>
                    {hasControlPerms ? (
                        <p>{scheduledRestartIsSkipped
                            ? t('Enable the next scheduled restart')
                            : hasScheduledRestart
                                ? t('Cancel the next scheduled restart')
                                : t('Schedule the next server restart')}</p>
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
