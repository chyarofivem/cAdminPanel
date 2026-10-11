import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";


type BanTemplatesListAddButtonProps = {
    onClick: () => void;
    disabled: boolean;
}

/**
 * The page's primary action, rendered in the page header.
 */
export default function BanTemplatesListAddButton({ onClick, disabled }: BanTemplatesListAddButtonProps) {
    return (
        <Button onClick={onClick} disabled={disabled}>
            {t('Add template')}
        </Button>
    )
}
