import { txToast } from '@/components/TxToaster';
import { fxRunnerStateAtom, txConfigStateAtom, useGlobalStatus } from '@/hooks/status';
import { playerCountAtom } from '@/hooks/playerlist';
import { useAtomValue } from 'jotai';
import { Badge } from '@/components/ui/badge';
import { msToShortDuration } from '@/lib/dateTime';
import { FxMonitorHealth } from '@shared/enums';
import { useOpenConfirmDialog, useOpenPromptDialog } from '@/hooks/dialogs';
import { ApiTimeout, useBackendApi } from '@/hooks/fetch';
import { useCloseAllSheets } from '@/hooks/sheets';
import { useAdminPerms } from '@/hooks/auth';
import { TxConfigState } from '@shared/enums';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { restartSchedulePromptProps } from './restartScheduleUtils';
import { validateRestartSchedule } from './restartScheduleValidation';


//NOTE: the sidebar grid cell is ~100px wide, and the button base class is `whitespace-nowrap`.
//Longer translations (eg. 'Restart' -> 'Ponovno pokreni') would paint outside the pill,
//so the label wraps onto a second line and the button grows instead of overflowing.
const controlButtonClass = 'h-auto w-full min-w-0 whitespace-normal break-words px-3 text-center leading-tight';


/**
 * One line of live server state. Status is always a word, never colour alone.
 */
function ServerStatusLine() {
    const globalStatus = useGlobalStatus();
    const playerCount = useAtomValue(playerCountAtom);
    if (!globalStatus) {
        return <p className="text-dense text-muted-foreground">{t('loading...')}</p>;
    }
    const { health, uptime } = globalStatus.server;
    const badge = health === FxMonitorHealth.ONLINE
        ? <Badge variant="success">{t('Online')}</Badge>
        : health === FxMonitorHealth.PARTIAL
            ? <Badge variant="warning">{t('Partial')}</Badge>
            : <Badge variant="danger">{t('Offline')}</Badge>;
    const scheduler = globalStatus.scheduler;
    const nextRestart = typeof scheduler.nextRelativeMs === 'number' && !scheduler.nextSkip
        ? msToShortDuration(scheduler.nextRelativeMs, { units: ['h', 'm'], delimiter: ' ' })
        : null;

    return <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
            <span title={t(globalStatus.server.healthReason)}>{badge}</span>
            {uptime > 0 && <span className="text-dense tabular-nums text-muted-foreground" title={t('Uptime')}>
                {msToShortDuration(uptime, { units: ['d', 'h', 'm'], delimiter: ' ' })}
            </span>}
        </div>
        <div className="flex items-center justify-between gap-2 text-dense">
            <span className="text-muted-foreground">{t('Players')}</span>
            <span className="tabular-nums text-white">{playerCount}</span>
        </div>
        {nextRestart && <div className="flex items-center justify-between gap-2 text-dense">
            <span className="text-muted-foreground">{t('Next restart')}</span>
            <span className="tabular-nums text-warning-text">{nextRestart}</span>
        </div>}
    </div>;
}

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
        return <p className="text-dense text-muted-foreground">{t('Server not configured.')}</p>;
    }

    const noControlTitle = hasControlPerms ? undefined : t('You do not have permission to control the server.');
    const noAnnounceTitle = hasAnnouncementPerm ? undefined : t('You do not have permission to send an announcement.');
    return (
        <div className="flex flex-col gap-4">
            <ServerStatusLine />
            <div className="grid grid-cols-2 gap-2" aria-label={t('Server controls')}>
                <Button
                    onClick={handleStartStop}
                    variant={fxRunnerState.isIdle ? 'secondary' : 'outline-destructive'}
                    className={controlButtonClass}
                    disabled={!hasControlPerms}
                    title={noControlTitle}
                >
                    {fxRunnerState.isIdle ? t('Start') : t('Stop')}
                </Button>
                <Button
                    onClick={handleRestart}
                    variant="secondary"
                    className={controlButtonClass}
                    disabled={!hasControlPerms || !fxRunnerState.isChildAlive}
                    title={noControlTitle}
                >
                    {t('Restart')}
                </Button>
                <Button
                    onClick={handleRestartSchedule}
                    variant={hasScheduledRestart && !scheduledRestartIsSkipped ? 'outline-destructive' : 'secondary'}
                    className={controlButtonClass}
                    disabled={!hasControlPerms}
                    title={noControlTitle ?? (scheduledRestartIsSkipped
                        ? t('Enable the next scheduled restart')
                        : hasScheduledRestart
                            ? t('Cancel the next scheduled restart')
                            : t('Schedule the next server restart'))}
                >
                    {scheduledRestartIsSkipped
                        ? t('Enable')
                        : hasScheduledRestart
                            ? t('Cancel')
                            : t('Schedule')}
                </Button>
                <Button
                    onClick={handleAnnounce}
                    variant="secondary"
                    className={controlButtonClass}
                    disabled={!hasAnnouncementPerm || !fxRunnerState.isChildAlive}
                    title={noAnnounceTitle}
                >
                    {t('Announce')}
                </Button>
            </div>
        </div>
    );
}
