import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

type CardContentOverlayProps = {
    loading?: boolean | string;
    error?: React.ReactNode;
    message?: React.ReactNode;
    className?: string;
};

/**
 * Covers a card's content with one line of text while it loads, fails or is unavailable.
 * The parent must be `relative`. No spinner, icon or blur: loading is one muted line.
 */
export default function CardContentOverlay({ loading, error, message, className }: CardContentOverlayProps) {
    let innerNode: React.ReactNode;
    if (loading) {
        innerNode = (
            <div className="text-sm text-muted-foreground">
                {typeof loading === 'string' ? loading : t('Loading...')}
            </div>
        );
    } else if (error) {
        innerNode = <div className="text-sm text-danger-text">{error}</div>;
    } else if (message) {
        innerNode = <div className="text-sm text-muted-foreground">{message}</div>;
    } else {
        return null;
    }
    return (
        <div
            role={error ? 'alert' : 'status'}
            className={cn("absolute inset-0 z-10 flex min-h-20 items-start rounded-[inherit] bg-modal p-4 sm:p-6", className)}
        >
            {innerNode}
        </div>
    );
}
