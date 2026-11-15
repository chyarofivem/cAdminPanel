import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
    message: string;
    /** At most one action: a button or a link, when there is a next step. */
    action?: React.ReactNode;
    /** One optional 32px outline icon above the message. */
    icon?: LucideIcon;
    className?: string;
};

/**
 * Empty state: centred inside the section it belongs to, an optional 32px outline icon
 * in the faint text colour, one 14px line saying what will appear here, and one action.
 * It has no surface of its own, so it never becomes a card inside a card.
 */
export default function EmptyState({ message, action, icon: Icon, className }: EmptyStateProps) {
    return <div role="status" className={cn('flex flex-col items-center gap-3 px-4 py-8 text-center', className)}>
        {Icon && <Icon aria-hidden="true" className="size-8 text-faint" />}
        <p className="max-w-[70ch] text-sm text-body">{message}</p>
        {action}
    </div>;
}
