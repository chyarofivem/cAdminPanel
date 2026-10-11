import { LocalStorageKey } from "@/lib/localStorage";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";
import React from "react";


/**
 * A dynamic component that shows its children for the first X days.
 * NOTE: always on for dev mode to make sure I doesn't forget to remove it.
 */
function DynamicNewItemInner({ featName, durationDays, children }: DynamicNewItemProps) {
    const storageKeyName = LocalStorageKey.NewFeatureSeenTs + featName;
    const storedTs = parseInt(localStorage.getItem(storageKeyName) ?? '');
    if (isNaN(storedTs) || window.txConsts.showAdvanced) {
        localStorage.setItem(storageKeyName, Date.now().toString());
    } else {
        const badgeDuration = (durationDays ?? 3) * 24 * 60 * 60 * 1000;

        if (storedTs + badgeDuration < Date.now()) {
            return null;
        }
    }

    return children;
}

export const DynamicNewItem = React.memo(DynamicNewItemInner);


/**
 * A plain accent badge that reads "New" for the first X days.
 */
function DynamicNewBadgeInner({ badgeText, featName, durationDays, className }: DynamicNewBadgeProps) {
    return (
        <DynamicNewItemInner featName={featName} durationDays={durationDays}>
            <Badge variant="accent" className={className}>
                {badgeText ?? t('New')}
            </Badge>
        </DynamicNewItemInner>
    );
}

export const DynamicNewBadge = React.memo(DynamicNewBadgeInner);


/**
 * Types
 */
type DynamicNewItemProps = {
    featName: string;
    durationDays?: number; //3d default
    children: React.ReactNode;
};

type DynamicNewBadgeProps = {
    featName: string;
    durationDays?: number; //3d default
    badgeText?: string;
    className?: string;
    /** Kept for older call sites; every badge now uses the one badge size. */
    size?: 'xs' | 'md' | null;
};
