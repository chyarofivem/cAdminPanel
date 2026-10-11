import React from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Section from '@/components/Section'
import { cn } from '@/lib/utils'
import { SettingsCardContext, SettingsPageContext } from './utils'
import { t } from '@/lib/i18n'


type SettingsCardShellProps = {
    cardCtx: SettingsCardContext;
    pageCtx: SettingsPageContext;
    advancedVisible?: boolean;
    advancedSetter?: (visible: boolean) => void;
    onClickSave: () => void;
    children: React.ReactNode;
};

/**
 * The settings card: one section with the fields, then the one Save button below them,
 * left-aligned. Fields inside are never wrapped in further cards.
 */
export default function SettingsCardShell({
    cardCtx,
    pageCtx,
    advancedVisible,
    advancedSetter,
    onClickSave,
    children,
}: SettingsCardShellProps) {
    const isCardPendingSave = pageCtx.cardPendingSave?.cardId === cardCtx.cardId;
    const isSavingThisCard = pageCtx.isSaving && isCardPendingSave;

    //The fields stay mounted while loading so uncontrolled inputs pick up their initial values
    let statusNode: React.ReactNode = null;
    if (pageCtx.isLoading) {
        statusNode = <p role="status" className="text-sm text-muted-foreground">{t('Loading settings...')}</p>;
    } else if (pageCtx.swrError) {
        statusNode = <Alert variant="destructive">
            <AlertTitle>{t('Could not load settings.')}</AlertTitle>
            <AlertDescription>{pageCtx.swrError}</AlertDescription>
        </Alert>;
    }

    return (
        <Section
            id={`tab-${cardCtx.cardId}`}
            data-show-advanced={advancedVisible}
            className="group/card"
            title={cardCtx.cardTitle}
            actions={isCardPendingSave ? <Badge variant="warning">{t('Unsaved changes')}</Badge> : undefined}
        >
            {statusNode}
            <div className={cn('flex min-w-0 flex-col gap-6', statusNode !== null && 'hidden')}>
                {children}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        disabled={!isCardPendingSave || pageCtx.isReadOnly}
                        onClick={onClickSave}
                    >
                        {isSavingThisCard ? t('Saving...') : t('Save changes')}
                    </Button>
                    {advancedVisible !== undefined && advancedSetter ? (
                        <Button
                            variant="secondary"
                            aria-expanded={advancedVisible}
                            onClick={() => advancedSetter(!advancedVisible)}
                        >
                            {advancedVisible ? t('Discard advanced') : t('Show advanced')}
                        </Button>
                    ) : null}
                </div>
            </div>
        </Section>
    )
}
