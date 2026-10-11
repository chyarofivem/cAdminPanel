import { cn } from '@/lib/utils';

type EmptyStateProps = {
    message: string;
    /** At most one action: a button or a link. */
    action?: React.ReactNode;
    className?: string;
};

/**
 * Empty states are one line of muted text and one action. No illustration, no icon.
 */
export default function EmptyState({ message, action, className }: EmptyStateProps) {
    return <div role="status" className={cn('flex flex-col items-start gap-3 rounded-lg bg-raise p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6', className)}>
        <p className="text-sm text-muted-foreground">{message}</p>
        {action}
    </div>;
}
