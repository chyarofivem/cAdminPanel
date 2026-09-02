import DebouncedResizeContainer from "@/components/DebouncedResizeContainer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DoorOpenIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import type { PlayerDropsSummaryHour } from "@shared/otherTypes";
import { PlayerDropsLoadingSpinner } from "./PlayerDropsGenericSubcards";
import TimelineDropsChart, { TimelineDropsChartData } from "./TimelineDropsChart";
import { processDropsSummary } from "./chartingUtils";
import { DisplayLodType, DrilldownRangeSelectionType } from "./PlayerDropsPage";
import { t } from "@/lib/i18n";


type PlayerDropsTimelineChartsProps = {
    isError?: boolean;
    dataTs?: number;
    summaryData?: PlayerDropsSummaryHour[];
    rangeSelected: DrilldownRangeSelectionType;
    rangeSetter: (range: DrilldownRangeSelectionType) => void;
    displayLod: DisplayLodType;
    setDisplayLod: (range: DisplayLodType) => void;
};

const TimelineCard = memo(({
    isError,
    dataTs,
    summaryData,
    rangeSelected,
    rangeSetter,
    displayLod,
    setDisplayLod
}: PlayerDropsTimelineChartsProps) => {
    const [expectedDropsChartSize, setExpectedDropsChartSize] = useState({ width: 0, height: 0 });
    const [unexpectedDropsChartSize, setUnexpectedDropsChartSize] = useState({ width: 0, height: 0 });

    //Process data only once
    const chartsData = useMemo(() => {
        if (!summaryData || !dataTs) return;
        const startDate = new Date(dataTs);
        const endDate = new Date(dataTs);
        if (displayLod === 'day') {
            // 14d window, 12h+15m padding start
            const chartDurationHours = (14 - 1) * 24; //minus 1 day
            startDate.setHours(-chartDurationHours - 12, 0, 0, 0);
            endDate.setHours(12, 0, 0, 0);
        } else {
            // 7d window, 30m+15m padding start
            const chartDurationHours = (7 * 24) + 1; //plus 1 hour
            startDate.setHours(startDate.getHours() - chartDurationHours, 15, 0, 0);
            endDate.setMinutes(endDate.getMinutes() + 30, 0, 0);
        }
        const processed = processDropsSummary(summaryData, displayLod, startDate);
        if (!processed) return;

        const commonProps = { displayLod, startDate, endDate };
        return {
            expected: {
                ...commonProps,
                maxDrops: processed.expectedSeriesMax,
                categoriesSorted: processed.expectedCategoriesSorted,
                log: processed.expectedSeries,
            } satisfies TimelineDropsChartData,
            unexpected: {
                ...commonProps,
                maxDrops: processed.unexpectedSeriesMax,
                categoriesSorted: processed.unexpectedCategoriesSorted,
                log: processed.unexpectedSeries,
            } satisfies TimelineDropsChartData,
        }
    }, [summaryData, displayLod]);

    return (
        <section className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
            <div className="flex flex-row items-center justify-between border-b border-dashed border-white/[0.07] px-4 sm:px-5">
                <div className="flex items-center py-3 space-x-2">
                    <div className='hidden xs:block'><DoorOpenIcon className="size-4" /></div>
                    <h2 className="text-sm font-medium">{t('Expected disconnects')}</h2>
                </div>
                <Select defaultValue={displayLod} onValueChange={setDisplayLod}>
                    <SelectTrigger
                        className="w-32 h-6 px-3 py-1 text-sm"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="px-0">
                        <SelectItem value={'day'} className="cursor-pointer">
                            {t('Days')}
                        </SelectItem>
                        <SelectItem value={'hour'} className="cursor-pointer">
                            {t('Hours')}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="h-36 max-h-36 bg-black/[0.08]">
                <DebouncedResizeContainer onDebouncedResize={setExpectedDropsChartSize}>
                    {chartsData ? (
                        <TimelineDropsChart
                            chartData={chartsData.expected}
                            chartName='expected'
                            width={expectedDropsChartSize.width}
                            height={expectedDropsChartSize.height}
                            rangeSelected={rangeSelected}
                            rangeSetter={rangeSetter}
                        />
                    ) : (
                        <PlayerDropsLoadingSpinner isError={isError} />
                    )}
                </DebouncedResizeContainer>
            </div>

            <div className="flex flex-row items-center justify-between border-b border-t border-dashed border-white/[0.07] px-4 sm:px-5">
                <div className="flex items-center py-3 gap-2">
                    <div className='hidden xs:block'><DoorOpenIcon className="size-4" /></div>
                    <h2 className="text-sm font-medium">{t('Unexpected disconnects')}</h2>
                </div>
            </div>
            <div className="h-56 max-h-56 bg-black/[0.08]">
                <DebouncedResizeContainer onDebouncedResize={setUnexpectedDropsChartSize}>
                    {chartsData ? (
                        <TimelineDropsChart
                            chartData={chartsData.unexpected}
                            chartName='unexpected'
                            width={unexpectedDropsChartSize.width}
                            height={unexpectedDropsChartSize.height}
                            rangeSelected={rangeSelected}
                            rangeSetter={rangeSetter}
                        />
                    ) : (
                        <PlayerDropsLoadingSpinner isError={isError} />
                    )}
                </DebouncedResizeContainer>
            </div>
        </section>
    );
});

export default memo(TimelineCard);
