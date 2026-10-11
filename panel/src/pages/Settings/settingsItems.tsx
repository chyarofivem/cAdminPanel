import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";


/**
 * An optional warning line with conditional rendering
 */
export function SettingItemWarningLine({ visible, children, className }: SettingItemWarningLineProps) {
    if (!visible) return null;
    return (
        <div className={cn("text-warning-text", className)}>
            {children}
        </div>
    );
}

type SettingItemWarningLineProps = {
    visible: boolean;
    children: React.ReactNode;
    className?: string;
}


/**
 * The helper text below a control: 13px muted.
 * NOTE: `text-dense` stays outside cn(), because tailwind-merge reads it as a text colour.
 */
export function SettingItemDesc({ children, className }: SettingItemDescProps) {
    return (
        <div className={`text-dense ${cn("attempt-word-wrap text-muted-foreground", className)}`}>
            {children}
        </div>
    );
}

type SettingItemDescProps = {
    children: React.ReactNode;
    className?: string;
}


/**
 * A setting item: 14px/500 white label above the control, helper text below it.
 */
export function SettingItem({
    label,
    htmlFor,
    required: isRequired,
    showOptional,
    showNew,
    showIf,
    children
}: SettingItemProps) {
    if (showIf !== undefined && !showIf) return null;
    return (
        <div className="flex max-w-2xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Label htmlFor={htmlFor}>{label}</Label>
                {showNew && <Badge variant="accent">{t('New')}</Badge>}
                {isRequired && <span className="text-dense text-muted-foreground">{t('Required')}</span>}
                {showOptional && <span className="text-dense text-muted-foreground">{t('Optional')}</span>}
            </div>
            {children}
        </div>
    )
}

type SettingItemProps = {
    label: string;
    htmlFor?: string;
    required?: boolean;
    showOptional?: boolean;
    showNew?: boolean;
    showIf?: boolean;
    children: React.ReactNode;
}


/**
 * A heading that starts a group of settings inside a settings card.
 */
export function SettingGroupHeading({ title, description }: SettingGroupHeadingProps) {
    return (
        <div className="border-t border-hairline pt-6">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {description && <p className="mt-1 text-dense text-muted-foreground">{description}</p>}
        </div>
    )
}

type SettingGroupHeadingProps = {
    title: string;
    description?: React.ReactNode;
}


/**
 * The heading above the advanced options.
 */
export function AdvancedDivider() {
    return <SettingGroupHeading title={t('Advanced Options')} />;
}
