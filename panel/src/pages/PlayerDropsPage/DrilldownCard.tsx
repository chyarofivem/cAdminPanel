import { BoxIcon, FolderOpenIcon, ShapesIcon, SkullIcon } from "lucide-react";
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
import { t } from "@/lib/i18n";


export function DrilldownCardLoading({ isError }: { isError?: boolean }) {
    return (
        <div className="space-y-3">
            <div className="space-x-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>{t('Loading...')}</span>
            </div>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] pb-2">
                <div className="flex flex-col flex-shrink px-4 sm:px-5 py-3 space-y-4 border-b border-dashed border-white/[0.07]">
                    <div className="flex items-center space-x-2">
                        <div className='hidden xs:block'><FolderOpenIcon className="size-4" /></div>
                        <h2 className="text-sm font-medium">{t('Overview')}</h2>
                    </div>
                </div>
                <div className="px-4 py-2 flex flex-wrap justify-evenly gap-4 text-muted-foreground">
                    <PlayerDropsLoadingSpinner isError={isError} />
                </div>
                <div className="flex flex-col flex-shrink px-4 sm:px-5 py-3 space-y-4 border-t border-b border-dashed border-white/[0.07]">
                    <div className="flex items-center space-x-2">
                        <div className='hidden xs:block'><ShapesIcon className="size-4" /></div>
                        <h2 className="text-sm font-medium">{t('Environment changes')}</h2>
                    </div>
                </div>
                <div className="px-4 pt-2 pb-4">
                    <PlayerDropsLoadingSpinner isError={isError} />
                </div>
                <div className="flex flex-col flex-shrink px-4 sm:px-5 py-3 space-y-4 border-t border-b border-dashed border-white/[0.07]">
                    <div className="flex items-center space-x-2">
                        <div className='hidden xs:block'><SkullIcon className="size-4" /></div>
                        <h2 className="text-sm font-medium">{t('Crash reasons')}</h2>
                    </div>
                </div>
                <div className="px-4 pt-2 pb-4 space-y-4">
                    <PlayerDropsLoadingSpinner isError={isError} />
                </div>
            </div>
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
            if (part === '{start}') return <InlineCode key={index} title={windowStartDate.toISOString()}>{windowStartStr}</InlineCode>;
            if (part === '{end}') return <InlineCode key={index} title={windowEndDate.toISOString()}>{windowEndStr}</InlineCode>;
            return part;
        });

    return (
        <div className="space-y-3">
            <div className={cn(
                "flex justify-center text-xs font-medium uppercase tracking-wider text-muted-foreground",
                rangeSelected && 'font-semibold text-primary'
            )}>
                <span>{periodNodes}</span>
            </div>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
                <div className="rounded-t-[inherit]">
                    <div className="flex flex-col flex-shrink px-4 sm:px-5 py-3 space-y-4 border-b border-dashed border-white/[0.07]">
                        <div className="flex items-center space-x-2">
                            <div className='hidden xs:block'><FolderOpenIcon className="size-4" /></div>
                            <h2 className="text-sm font-medium">{t('Period overview')}</h2>
                        </div>
                    </div>
                    <DrilldownOverviewSubcard dropTypes={windowData.dropTypes} />
                </div>

                <div className="pb-4">
                    <div className="flex flex-col flex-shrink px-4 sm:px-5 py-3 space-y-4 border-t border-b border-dashed border-white/[0.07]">
                        <div className="flex items-center space-x-2">
                            <div className='hidden xs:block'><BoxIcon className="size-4" /></div>
                            <h2 className="text-sm font-medium">{t('Resource kicks')}</h2>
                        </div>
                    </div>
                    <DrilldownResourcesSubcard resKicks={windowData.resKicks} />
                </div>

                <div className="pb-4">
                    <div className="flex flex-col flex-shrink px-4 sm:px-5 py-3 space-y-4 border-t border-b border-dashed border-white/[0.07]">
                        <div className="flex items-center space-x-2">
                            <div className='hidden xs:block'><ShapesIcon className="size-4" /></div>
                            <h2 className="text-sm font-medium">{t('Environment changes')}</h2>
                            <DynamicNewItem featName="playerDropsEnvChangesReversed" durationDays={14}>
                                <span className="text-2xs text-warning-inline/80">{t('Note: This list now shows the most recent changes first.')}</span>
                            </DynamicNewItem>
                        </div>
                    </div>
                    <DrilldownChangesSubcard changes={windowData.changes} />
                </div>

                <div className="">
                    <div className="flex flex-col gap-3 border-t border-b border-dashed border-white/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="flex items-center space-x-2">
                            <div className='hidden xs:block'><SkullIcon className="size-4" /></div>
                            <h2 className="text-sm font-medium">{t('Crash reasons')}</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Select
                                value={crashesTargetLimit.toString()}
                                onValueChange={(value) => setCrashesTargetLimit(parseInt(value))}
                            >
                                <SelectTrigger
                                    className="w-32 h-6 px-3 py-1 text-sm"
                                >
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
                                <SelectTrigger
                                    className="w-36 h-6 px-3 py-1 text-sm"
                                >
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
                    </div>
                    <DrilldownCrashesSubcard
                        crashTypes={windowData.crashTypes}
                        crashesGroupReasons={crashesGroupReasons}
                        crashesTargetLimit={crashesTargetLimit}
                        setCrashesTargetLimit={setCrashesTargetLimit}
                    />
                </div>
            </div>
        </div>
    )
};

export default memo(DrilldownCardInner);
