import { memo, useState } from "react";
import type { PlayerDropsApiSuccessResp } from "@shared/otherTypes";
import { cn } from "@/lib/utils";
import { dateToLocaleDateString, dateToLocaleTimeString, isDateToday } from "@/lib/dateTime";
import DrilldownCrashesSubcard from "./DrilldownCrashesSubcard";
import { PlayerDropsLoadingSpinner } from "./PlayerDropsGenericSubcards";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DrilldownChangesSubcard from "./DrilldownChangesSubcard";
import DrilldownOverviewSubcard from "./DrilldownOverviewSubcard";
import { DisplayLodType, DrilldownRangeSelectionType } from "./PlayerDropsPage";
import InlineCode from "@/components/InlineCode";
import DrilldownResourcesSubcard from "./DrilldownResourcesSubcard";
import { DynamicNewItem } from "@/components/DynamicNewBadge";
import Section from "@/components/Section";
import { t } from "@/lib/i18n";


/**
 * Heading for a block whose records sit directly on the page, with optional controls on the right.
 */
function BlockHeading({ title, children }: { title: string; children?: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {children}
        </div>
    );
}

/**
 * Loading or error placeholder for a block that sits directly on the page.
 */
function BlockLoading({ isError }: { isError?: boolean }) {
    return (
        <div className="rounded-lg bg-raise">
            <PlayerDropsLoadingSpinner isError={isError} />
        </div>
    );
}


export function DrilldownCardLoading({ isError }: { isError?: boolean }) {
    return (
        <div className="flex flex-col gap-6">
            <Section title={t('Period overview')}>
                <PlayerDropsLoadingSpinner isError={isError} />
            </Section>
            <section className="flex flex-col gap-3">
                <BlockHeading title={t('Resource kicks')} />
                <BlockLoading isError={isError} />
            </section>
            <section className="flex flex-col gap-3">
                <BlockHeading title={t('Environment changes')} />
                <BlockLoading isError={isError} />
            </section>
            <section className="flex flex-col gap-3">
                <BlockHeading title={t('Crash reasons')} />
                <BlockLoading isError={isError} />
            </section>
        </div>
    );
}

type DrilldownCardProps = PlayerDropsApiSuccessResp['detailed'] & {
    rangeSelected: DrilldownRangeSelectionType;
    displayLod: DisplayLodType;
};

const DrilldownCardInner = function DrilldownCard({
    windowStart,
    windowEnd,
    windowData,
    rangeSelected,
    displayLod,
}: DrilldownCardProps) {
    const [crashesTargetLimit, setCrashesTargetLimit] = useState(50);
    const [crashesGroupReasons, setCrashesGroupReasons] = useState(false);

    //Window indicator
    const windowStartDate = new Date(windowStart);
    const windowEndDate = new Date(windowEnd);
    const showDate = !isDateToday(windowStartDate) || !isDateToday(windowEndDate);

    const windowStartTimeStr = dateToLocaleTimeString(windowStartDate, '2-digit', '2-digit');
    const windowStartDateStr = dateToLocaleDateString(windowStartDate, 'short');
    const windowStartStr = showDate ? `${windowStartTimeStr} - ${windowStartDateStr}` : windowStartTimeStr;
    const windowEndTimeStr = dateToLocaleTimeString(windowEndDate, '2-digit', '2-digit');
    const windowEndDateStr = dateToLocaleDateString(windowEndDate, 'short');
    const windowEndStr = showDate ? `${windowEndTimeStr} - ${windowEndDateStr}` : windowEndTimeStr;

    //One dictionary key keeps the sentence orderable for translators. t() leaves
    //unfilled placeholders untouched, so both timestamps are spliced back in as
    //InlineCode nodes that keep their ISO tooltip.
    const periodNodes = t('Period from {start} to {end}.')
        .split(/(\{start\}|\{end\})/)
        .map((part, index) => {
            if (part === '{start}') return <InlineCode key={index} className="tabular-nums" title={windowStartDate.toISOString()}>{windowStartStr}</InlineCode>;
            if (part === '{end}') return <InlineCode key={index} className="tabular-nums" title={windowEndDate.toISOString()}>{windowEndStr}</InlineCode>;
            return part;
        });

    return (
        <div className="flex flex-col gap-6">
            <Section
                title={t('Period overview')}
                description={<span className={cn(rangeSelected && 'font-medium text-white')}>{periodNodes}</span>}
            >
                <DrilldownOverviewSubcard dropTypes={windowData.dropTypes} />
            </Section>

            <section className="flex flex-col gap-3">
                <BlockHeading title={t('Resource kicks')} />
                <DrilldownResourcesSubcard resKicks={windowData.resKicks} />
            </section>

            <section className="flex flex-col gap-3">
                <div>
                    <BlockHeading title={t('Environment changes')} />
                    <DynamicNewItem featName="playerDropsEnvChangesReversed" durationDays={14}>
                        <p className="mt-1 text-dense text-muted-foreground">{t('Note: This list now shows the most recent changes first.')}</p>
                    </DynamicNewItem>
                </div>
                <DrilldownChangesSubcard changes={windowData.changes} />
            </section>

            <section className="flex flex-col gap-3">
                <BlockHeading title={t('Crash reasons')}>
                    <div className="flex flex-wrap gap-2">
                        <Select
                            value={crashesTargetLimit.toString()}
                            onValueChange={(value) => setCrashesTargetLimit(parseInt(value))}
                        >
                            <SelectTrigger className="w-32 text-dense sm:h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="px-0">
                                <SelectItem value={'50'} className="cursor-pointer">
                                    {t('Top ~{count}', { count: 50 })}
                                </SelectItem>
                                <SelectItem value={'100'} className="cursor-pointer">
                                    {t('Top ~{count}', { count: 100 })}
                                </SelectItem>
                                <SelectItem value={'0'} className="cursor-pointer">
                                    {t('Show All')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={crashesGroupReasons.toString()}
                            onValueChange={(value) => setCrashesGroupReasons(value === 'true')}
                        >
                            <SelectTrigger className="w-36 text-dense sm:h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="px-0">
                                <SelectItem value={'false'} className="cursor-pointer">
                                    {t('Sort by Count')}
                                </SelectItem>
                                <SelectItem value={'true'} className="cursor-pointer">
                                    {t('Group Reasons')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </BlockHeading>
                <DrilldownCrashesSubcard
                    crashTypes={windowData.crashTypes}
                    crashesGroupReasons={crashesGroupReasons}
                    crashesTargetLimit={crashesTargetLimit}
                    setCrashesTargetLimit={setCrashesTargetLimit}
                />
            </section>
        </div>
    )
};

export default memo(DrilldownCardInner);
