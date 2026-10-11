import { cn } from '@/lib/utils';

/**
 * List rows hold records: full width, raise background, radius-lg, 8px between rows,
 * no dividers. Never put rows inside a card.
 */
export function ListRows({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div role="list" className={cn('flex flex-col gap-2', className)} {...props} />;
}

type ListRowProps = React.HTMLAttributes<HTMLDivElement> & {
    /** Makes the whole row a hover target. Use with an inner link or button. */
    interactive?: boolean;
};
export function ListRow({ className, interactive, ...props }: ListRowProps) {
    return <div
        role="listitem"
        className={cn(
            'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg bg-raise px-4 py-3 sm:px-5',
            interactive && 'transition-colors duration-150 hover:bg-raise-2',
            className,
        )}
        {...props}
    />;
}
