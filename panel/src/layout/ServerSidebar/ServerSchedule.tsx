import InlineCode from '@/components/InlineCode';
import { txToast } from '@/components/TxToaster';
import { Button } from '@/components/ui/button';
import { useOpenPromptDialog } from '@/hooks/dialogs';
import { useCloseAllSheets } from '@/hooks/sheets';
import { useGlobalStatus } from '@/hooks/status';
import { useBackendApi } from '@/hooks/fetch';
import { cn } from '@/lib/utils';
import { msToDuration } from '@/lib/dateTime';
import { PenLineIcon, PlayCircleIcon, PlusCircleIcon, XCircleIcon } from 'lucide-react';
import { useAdminPerms } from '@/hooks/auth';
import { t } from '@/lib/i18n';

//Prompt props
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const timezoneDiffMessage = (
    <p className='text-destructive'>
        {t("Server's timezone")}: <b>{window.txConsts.serverTimezone}</b> <br />
        {t('Your timezone')}: <b>{browserTimezone}</b> <br />
        {t('Use relative time or schedule against the server timezone.')}
    </p>
)
const promptCommonProps = {
    suggestions: ['+5', '+10', '+15', '+30'],
    title: t('When should the server restart?'),
    message: (<>
        <p>
            {t('Possible formats')}: <br />
            <ul className='list-disc ml-4'>
                <li>
                    <InlineCode>+MM</InlineCode> {t('relative time in minutes')}
                    {' '}({t('example')}: <InlineCode>+15</InlineCode> {t('for 15 minutes from now')}).
                </li>
                <li>
                    <InlineCode>HH:MM</InlineCode> {t('absolute 24-hour time')}
                    {' '}({t('example')}: <InlineCode>23:30</InlineCode> {t('for 11:30 PM')}).
                </li>
            </ul>
        </p>
        {browserTimezone !== window.txConsts.serverTimezone && timezoneDiffMessage}
    </>),
    placeholder: '+15',
    required: true,
    isWide: true,
};

//Validate schedule time input for 24h format or relative time
const validateSchedule = (input: string) => {
    if (input.startsWith('+')) {
        const minutes = parseInt(input.substring(1));
        if (isNaN(minutes) || minutes < 1 || minutes >= 1440) {
            return false;
        }
    } else {
        const [hours, minutes] = input.split(':', 2).map(x => parseInt(x));
        if (
            typeof hours === 'undefined' || isNaN(hours) || hours < 0 || hours > 23
            || typeof minutes === 'undefined' || isNaN(minutes) || minutes < 0 || minutes > 59
        ) {
            return false;
        }
    }
    return true;
}


export default function ServerSchedule() {
    const closeAllSheets = useCloseAllSheets();
    const openPromptDialog = useOpenPromptDialog();
    const { hasPerm } = useAdminPerms();
    const schedulerApi = useBackendApi({
        method: 'POST',
        path: '/fxserver/schedule'
    });

    const globalStatus = useGlobalStatus();
    if (!globalStatus) {
        return <div>
            <h2 className="mb-1 text-lg font-semibold tracking-tight">
                {t('Next Restart')}:
            </h2>
            <span className='font-light text-muted-foreground italic'>{t('loading...')}</span>
        </div>
    }

    //Processing status
    const { scheduler } = globalStatus;
    let nextScheduledText = t('nothing scheduled');
    let nextScheduledClasses = 'text-muted-foreground italic';
    let disableAddEditBtn = false;
    let showCancelBtn = false;
    let showEnableBtn = false;
    const hasScheduledRestart = typeof scheduler.nextRelativeMs === 'number';
    if (hasScheduledRestart) {
        const tempFlag = (scheduler.nextIsTemp) ? t('(temporary)') : '';
        const relativeTime = msToDuration(scheduler.nextRelativeMs, { units: ['h', 'm'] });
        const isLessThanMinute = scheduler.nextRelativeMs < 60_000;
        if (isLessThanMinute) {
            disableAddEditBtn = true;
            nextScheduledText = t('right now {suffix}', { suffix: tempFlag });
        } else {
            nextScheduledText = t('in {duration} {suffix}', { duration: relativeTime, suffix: tempFlag });
        }

        if (scheduler.nextSkip) {
            nextScheduledClasses = 'text-muted-foreground line-through';
            if (!isLessThanMinute) {
                showEnableBtn = true;
            }
        } else {
            nextScheduledClasses = 'text-warning-inline';
            if (!isLessThanMinute) {
                showCancelBtn = true;
            }
        }
    }


    //Handlers
    const onScheduleSubmit = (input: string) => {
        closeAllSheets();
        if (input.includes(',')) {
            txToast.error({
                title: t('Invalid scheduled restart time.'),
                msg: t('Multiple restart times can only be configured in Settings. This field schedules only the next temporary restart.'),
            }, { duration: 10000 });
            return;
        }
        if (!validateSchedule(input)) {
            txToast.error(t('Invalid schedule time: {input}', { input }));
            return;
        }
        schedulerApi({
            data: { action: 'setNextTempSchedule', parameter: input },
            toastLoadingMessage: t('Scheduling server restart...'),
        });
    }
    const handleEdit = () => {
        openPromptDialog({
            ...promptCommonProps,
            onSubmit: onScheduleSubmit,
            submitLabel: t('Edit'),
        });
    }
    const handleAddSchedule = () => {
        openPromptDialog({
            ...promptCommonProps,
            onSubmit: onScheduleSubmit,
            submitLabel: t('Schedule'),
        });
    }
    const handleCancel = () => {
        closeAllSheets();
        schedulerApi({
            data: { action: 'setNextSkip', parameter: true },
            toastLoadingMessage: t('Cancelling next server restart...'),
        });
    }
    const handleEnable = () => {
        closeAllSheets();
        schedulerApi({
            data: { action: 'setNextSkip', parameter: false },
            toastLoadingMessage: t('Enabling next server restart...'),
        });
    }

    const hasSchedulePerms = hasPerm('control.server');

    return <div>
        <h2 className="mb-1 text-lg font-semibold tracking-tight">
            {t('Next Restart')}:
        </h2>
        <span className={cn('font-light', nextScheduledClasses)}>{nextScheduledText}</span>
        <div className='flex flex-row justify-between gap-2 mt-2 flex-wrap'>
            {hasScheduledRestart ? (
                <Button
                    size='xs'
                    variant='ghost'
                    className='flex-grow bg-muted border shadow'
                    disabled={!hasSchedulePerms || disableAddEditBtn}
                    onClick={handleEdit}
                >
                    <PenLineIcon className='h-4 w-4 mr-1' /> {t('Edit')}
                </Button>
            ) : (
                <Button
                    size='xs'
                    variant='ghost'
                    className='flex-grow bg-muted border shadow'
                    disabled={!hasSchedulePerms || disableAddEditBtn}
                    onClick={handleAddSchedule}
                >
                    <PlusCircleIcon className='h-4 w-4 mr-1' /> {t('Schedule Restart')}
                </Button>
            )}
            {showCancelBtn && (
                <Button
                    size='xs'
                    variant='ghost'
                    className='flex-grow bg-muted border shadow'
                    onClick={handleCancel}
                    disabled={!hasSchedulePerms}
                >
                    <XCircleIcon className='h-4 w-4 mr-1' /> {t('Cancel')}
                </Button>
            )}
            {showEnableBtn && (
                <Button
                    size='xs'
                    variant='ghost'
                    className='flex-grow bg-muted border'
                    onClick={handleEnable}
                    disabled={!hasSchedulePerms}
                >
                    <PlayCircleIcon className='h-4 w-4 mr-1' /> {t('Enable')}
                </Button>
            )}
        </div>
    </div>
}
