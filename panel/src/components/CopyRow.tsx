import { useRef } from 'react';
import { CopyIcon } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { txToast } from '@/components/TxToaster';
import { cn, copyToClipboard } from '@/lib/utils';
import { t } from '@/lib/i18n';

type CopyRowProps = {
    /** The value shown in monospace and copied. */
    value: string;
    /** Optional short label before the value, eg. `license`. */
    label?: string;
    className?: string;
};

/**
 * Addresses, ports, IDs and keys: a full-width monospace row with a copy button.
 */
export default function CopyRow({ value, label, className }: CopyRowProps) {
    const rowRef = useRef<HTMLDivElement>(null);
    const handleCopy = async () => {
        if (!rowRef.current) return;
        try {
            const result = await copyToClipboard(value, rowRef.current);
            if (result === false) throw new Error('copy failed');
            txToast.success(t('Copied to clipboard.'));
        } catch (error) {
            txToast.error(t('Could not copy to the clipboard.'));
        }
    };

    return <div ref={rowRef} className={cn('flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg bg-raise py-1 pl-4 pr-1', className)}>
        {label && <span className="shrink-0 text-dense text-muted-foreground">{label}</span>}
        <code className="min-w-0 flex-1 break-all font-mono text-dense text-white">{value}</code>
        <IconButton label={t('Copy')} icon={<CopyIcon />} onClick={handleCopy} />
    </div>;
}
