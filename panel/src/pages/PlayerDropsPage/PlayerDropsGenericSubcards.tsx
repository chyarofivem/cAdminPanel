import { t } from "@/lib/i18n";

type PlayerDropsLoadingSpinnerProps = {
    isError?: boolean;
};
/**
 * Loading or error state for a chart or block: one line of muted (or danger) text.
 */
export function PlayerDropsLoadingSpinner({ isError }: PlayerDropsLoadingSpinnerProps) {
    if (isError) {
        return (
            <div role="alert" className="flex h-full min-h-28 items-center justify-center p-4 text-center text-sm text-danger-text">
                {t('Error loading data.')}
            </div>
        );
    } else {
        return (
            <div role="status" className="flex h-full min-h-28 items-center justify-center p-4 text-center text-sm text-muted-foreground">
                {t('Loading…')}
            </div>
        );
    }
}

type PlayerDropsMessageProps = {
    message: string;
};
/**
 * Empty message inside a chart or section. Blocks placed directly on the page use EmptyState instead.
 */
export function PlayerDropsMessage({ message }: PlayerDropsMessageProps) {
    return (
        <div className="flex h-full min-h-28 items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {message}
        </div>
    )
}
