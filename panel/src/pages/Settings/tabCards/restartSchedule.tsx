import { useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { PlusIcon, TrashIcon, XIcon } from 'lucide-react';
import InlineCode from '@/components/InlineCode';
import { TimeInputDialog } from '@/components/TimeInputDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SettingItemDesc } from '../settingsItems';
import type { PageConfigReducerAction } from '../utils';

function sanitizeTimes(times: string[]): string[] {
    return Array.from(new Set(times)).sort((a, b) => {
        const [aHours, aMinutes] = a.split(':').map(Number);
        const [bHours, bMinutes] = b.split(':').map(Number);
        return aHours - bHours || aMinutes - bMinutes;
    });
}

type RestartScheduleBoxProps = {
    restartTimes: string[] | undefined;
    setRestartTimes: (val: PageConfigReducerAction<string[] | undefined>['configValue']) => void;
    disabled?: boolean;
};

export function RestartScheduleBox({ restartTimes, setRestartTimes, disabled }: RestartScheduleBoxProps) {
    const [isTimeInputOpen, setIsTimeInputOpen] = useState(false);
    const [animationParent] = useAutoAnimate();

    const addTime = (time: string) => {
        if (!restartTimes || disabled) return;
        setRestartTimes(prev => sanitizeTimes([...(prev ?? []), time]));
    };
    const removeTime = (index: number) => {
        if (!restartTimes || disabled) return;
        setRestartTimes(prev => sanitizeTimes((prev ?? []).filter((_, i) => i !== index)));
    };
    const applyPreset = (presetTimes: string[]) => {
        if (!restartTimes || disabled) return;
        setRestartTimes(presetTimes);
    };
    const clearTimes = () => {
        if (disabled) return;
        setRestartTimes([]);
    };

    const presetSpanClasses = cn(
        'text-muted-foreground',
        disabled && 'cursor-not-allowed opacity-50',
    );

    return (
        <div className="flex min-h-[4.5rem] items-center rounded-lg border px-2 py-3">
            <div className={cn('flex w-full items-center gap-2', disabled && 'cursor-not-allowed')}>
                <div ref={animationParent} className="flex grow flex-wrap gap-2">
                    {restartTimes && restartTimes.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                            <span>No schedule set. Click the <strong>+</strong> button to add a time.</span>
                            <p>
                                {'Presets: '}
                                <PresetLink onClick={() => applyPreset(['00:00'])}>1x<span className={presetSpanClasses}>/day</span></PresetLink>
                                {', '}
                                <PresetLink onClick={() => applyPreset(['00:00', '12:00'])}>2x<span className={presetSpanClasses}>/day</span></PresetLink>
                                {', '}
                                <PresetLink onClick={() => applyPreset(['00:00', '08:00', '16:00'])}>3x<span className={presetSpanClasses}>/day</span></PresetLink>
                                {', '}
                                <PresetLink onClick={() => applyPreset(['00:00', '06:00', '12:00', '18:00'])}>4x<span className={presetSpanClasses}>/day</span></PresetLink>
                            </p>
                        </div>
                    )}
                    {restartTimes?.map((time, index) => (
                        <div key={time} className="flex select-none items-center space-x-1 rounded-md bg-secondary px-3 py-1 text-secondary-foreground">
                            <span className="font-mono">{time}</span>
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => removeTime(index)}
                                    className="ml-2 text-secondary-foreground/50 hover:text-destructive"
                                    aria-label={`Remove ${time}`}
                                >
                                    <XIcon className="size-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        onClick={() => setIsTimeInputOpen(true)}
                        variant="secondary"
                        size="xs"
                        className="w-10 hover:bg-primary hover:text-primary-foreground"
                        aria-label="Add restart time"
                        disabled={disabled}
                    >
                        <PlusIcon className="h-4" />
                    </Button>
                    <Button
                        type="button"
                        onClick={clearTimes}
                        variant="muted"
                        size="xs"
                        className="w-10 hover:bg-destructive hover:text-destructive-foreground"
                        aria-label="Clear restart schedule"
                        disabled={disabled || !restartTimes?.length}
                    >
                        <TrashIcon className="h-3.5" />
                    </Button>
                </div>
            </div>
            <TimeInputDialog
                title="Add Restart Time"
                isOpen={isTimeInputOpen}
                onClose={() => setIsTimeInputOpen(false)}
                onSubmit={addTime}
            />
        </div>
    );
}

function PresetLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return <button type="button" onClick={onClick} className="cursor-pointer text-sm text-primary hover:underline">{children}</button>;
}

export function TimeZoneWarning() {
    try {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (window.txConsts.serverTimezone !== browserTimezone) {
            return (
                <SettingItemDesc className="text-destructive-inline">
                    <strong>Warning:</strong> Your server timezone is <InlineCode>{window.txConsts.serverTimezone}</InlineCode>, while your browser timezone is <InlineCode>{browserTimezone}</InlineCode>. Configure restart times for the server timezone.
                </SettingItemDesc>
            );
        }
    } catch (error) {
        console.error(error);
    }
    return null;
}
