import { cn } from '@/lib/utils';

type UsageBarProps = {
    label: string;
    /** Human units, eg. `4 / 16 GB`. Never raw megabytes. */
    valueLabel: string;
    /** 0 to 100. */
    percent: number;
    /**
     * `usage` (default) warns above 75% and alerts above 90%, because full is bad.
     * `progress` always uses the accent, because full means done (eg a download).
     */
    kind?: 'usage' | 'progress';
    /**
     * Work with no known end: `percent` is ignored and an accent segment slides along the
     * track, with the top loading bar's motion. Reduced motion shows a full bar instead.
     */
    indeterminate?: boolean;
    className?: string;
};

/**
 * Usage bar: 6px pill on a raise-2 track. The fill follows the accent, turns warning
 * above 75% and danger above 90%. The label shows human units above the bar.
 */
export default function UsageBar({ label, valueLabel, percent, kind = 'usage', indeterminate, className }: UsageBarProps) {
    const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
    const fillClass = kind === 'progress' || indeterminate
        ? 'bg-accent'
        : clamped > 90 ? 'bg-danger' : clamped > 75 ? 'bg-warning' : 'bg-accent';
    return <div className={cn('min-w-0', className)}>
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-dense">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums text-white">{valueLabel}</span>
        </div>
        <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-raise-2"
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
            aria-valuetext={valueLabel}
        >
            {indeterminate
                ? <div className={cn('h-full w-2/5 animate-loading-bar rounded-full motion-reduce:w-full motion-reduce:animate-none', fillClass)} />
                : <div className={cn('h-full rounded-full transition-[width] duration-150', fillClass)} style={{ width: `${clamped}%` }} />}
        </div>
    </div>;
}
