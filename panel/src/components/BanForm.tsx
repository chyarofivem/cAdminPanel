import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClosePlayerModal } from "@/hooks/playerModal";
import { ClipboardPasteIcon } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { DropDownSelect, DropDownSelectContent, DropDownSelectItem, DropDownSelectTrigger } from "@/components/dropDownSelect";
import { banDurationToShortString, banDurationToString } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import type { BanTemplatesDataType } from "@shared/otherTypes";
import { t } from '@/lib/i18n';

// Consts
const reasonTruncateLength = 150;
const ADD_NEW_SELECT_OPTION = '!add-new';
const defaultDurations = ['permanent', '2 hours', '8 hours', '1 day', '2 days', '1 week', '2 weeks'];

// Types
type BanFormRespType = {
    reason: string;
    duration: string;
}
export type BanFormType = HTMLDivElement & {
    focusReason: () => void;
    clearData: () => void;
    getData: () => BanFormRespType;
}
type BanFormProps = {
    banTemplates?: BanTemplatesDataType[]; //undefined = loading
    disabled?: boolean;
    onNavigateAway?: () => void;
};

/**
 * A form to set ban reason and duration.
 */
export default forwardRef(function BanForm({ banTemplates, disabled, onNavigateAway }: BanFormProps, ref) {
    const reasonRef = useRef<HTMLInputElement>(null);
    const customMultiplierRef = useRef<HTMLInputElement>(null);
    const setLocation = useLocation()[1];
    const [currentDuration, setCurrentDuration] = useState('2 days');
    const [customUnits, setCustomUnits] = useState('days');
    const closeModal = useClosePlayerModal();

    //Exposing methods to the parent
    useImperativeHandle(ref, () => {
        return {
            getData: () => {
                return {
                    reason: reasonRef.current?.value.trim(),
                    duration: currentDuration === 'custom'
                        ? `${customMultiplierRef.current?.value} ${customUnits}`
                        : currentDuration,
                };
            },
            clearData: () => {
                if (!reasonRef.current || !customMultiplierRef.current) return;
                reasonRef.current.value = '';
                customMultiplierRef.current.value = '';
                setCurrentDuration('2 days');
                setCustomUnits('days');
            },
            focusReason: () => {
                reasonRef.current?.focus();
            }
        };
    }, [reasonRef, customMultiplierRef, currentDuration, customUnits]);

    const handleTemplateSelectChange = (value: string) => {
        if (value === ADD_NEW_SELECT_OPTION) {
            setLocation('/settings/ban-templates');
            onNavigateAway?.();
        } else {
            if (!banTemplates) return;
            const template = banTemplates.find(template => template.id === value);
            if (!template) return;

            const processedDuration = banDurationToString(template.duration);
            if (defaultDurations.includes(processedDuration)) {
                setCurrentDuration(processedDuration);
            } else if (typeof template.duration === 'object') {
                setCurrentDuration('custom');
                customMultiplierRef.current!.value = template.duration.value.toString();
                setCustomUnits(template.duration.unit);
            }

            reasonRef.current!.value = template.reason;
            setTimeout(() => {
                reasonRef.current!.focus();
            }, 50);
        }
    }

    //Ban templates render optimization
    const processedTemplates = useMemo(() => {
        if (!banTemplates) return;
        return banTemplates.map((template, index) => {
            const duration = banDurationToShortString(template.duration);
            const reason = template.reason.length > reasonTruncateLength
                ? template.reason.slice(0, reasonTruncateLength - 3) + '...'
                : template.reason;
            return (
                <DropDownSelectItem
                    key={index}
                    value={template.id}
                    className="focus:bg-raise-2 focus:text-white"
                >
                    <span
                        className="inline-block min-w-[4ch] pr-1 font-mono text-muted-foreground"
                    >{duration}</span> {reason}
                </DropDownSelectItem>
            );
        });
    }, [banTemplates]);

    // Simplifying the jsx below
    let banTemplatesContentNode: React.ReactNode;
    if (!Array.isArray(banTemplates)) {
        banTemplatesContentNode = (
            <div role="status" className="p-4 text-center text-sm text-muted-foreground">
                {t('Loading...')}
            </div>
        );
    } else {
        if (!banTemplates.length) {
            banTemplatesContentNode = (
                <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-warning-text">
                    {t('You do not have any ban templates configured.')}
                    <Link
                        href="/settings/ban-templates"
                        className="cursor-pointer text-accent-text underline-offset-4 hover:text-accent-glow hover:underline"
                        onClick={() => { closeModal(); }}
                    >
                        {t('Add Ban Template')}
                    </Link>
                </div>
            );
        } else {
            banTemplatesContentNode = <>
                {processedTemplates}
                <DropDownSelectItem
                    value={ADD_NEW_SELECT_OPTION}
                    className="font-medium text-accent-text focus:bg-raise-2 focus:text-accent-glow"
                >
                    {t('Add Ban Template')}
                </DropDownSelectItem>
            </>;
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <Label htmlFor="banReason">
                    {t('Reason')}
                </Label>
                <div className="flex items-center gap-2">
                    <Input
                        id="banReason"
                        ref={reasonRef}
                        placeholder={t('The reason for the ban, rule violated, etc.')}
                        className="w-full"
                        disabled={disabled}
                        autoFocus
                    />
                    <DropDownSelect onValueChange={handleTemplateSelectChange} disabled={disabled}>
                        <DropDownSelectTrigger>
                            <IconButton
                                label={t('Ban Templates')}
                                icon={<ClipboardPasteIcon />}
                                variant="secondary"
                                className="size-11"
                            />
                        </DropDownSelectTrigger>
                        <DropDownSelectContent className="w-[calc(100vw-1rem)] sm:max-w-screen-sm" align="end">
                            {banTemplatesContentNode}
                        </DropDownSelectContent>
                    </DropDownSelect>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="durationSelect">
                    {t('Duration')}
                </Label>
                <div className="flex flex-col gap-2">
                    <Select
                        onValueChange={setCurrentDuration}
                        value={currentDuration}
                        disabled={disabled}
                    >
                        <SelectTrigger id="durationSelect">
                            <SelectValue placeholder={t('Select Duration')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="custom" className="font-medium">{t('Custom (set below)')}</SelectItem>
                            <SelectItem value="2 hours">{t('2 hours')}</SelectItem>
                            <SelectItem value="8 hours">{t('8 hours')}</SelectItem>
                            <SelectItem value="1 day">{t('1 day')}</SelectItem>
                            <SelectItem value="2 days">{t('2 days')}</SelectItem>
                            <SelectItem value="1 week">{t('1 week')}</SelectItem>
                            <SelectItem value="2 weeks">{t('2 weeks')}</SelectItem>
                            <SelectItem value="permanent" className="font-medium">{t('Permanent')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex flex-row gap-2">
                        <Input
                            id="durationMultiplier"
                            type="number"
                            className="tabular-nums"
                            aria-label={t('Duration')}
                            placeholder="123"
                            required
                            disabled={currentDuration !== 'custom' || disabled}
                            ref={customMultiplierRef}
                        />
                        <Select
                            onValueChange={setCustomUnits}
                            value={customUnits}
                        >
                            <SelectTrigger
                                id="durationUnits"
                                disabled={currentDuration !== 'custom' || disabled}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="hours">{t('Hours')}</SelectItem>
                                <SelectItem value="days">{t('Days')}</SelectItem>
                                <SelectItem value="weeks">{t('Weeks')}</SelectItem>
                                <SelectItem value="months">{t('Months')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    );
});
