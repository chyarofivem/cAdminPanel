import { t } from '@/lib/i18n';

type GenericSpinnerProps = {
    msg?: string;
}

/**
 * Loading state: one line of muted text, no spinner.
 */
export default function GenericSpinner({ msg }: GenericSpinnerProps) {
    return <p role="status" className="text-sm text-muted-foreground">
        {msg || t('Loading…')}
    </p>;
}
