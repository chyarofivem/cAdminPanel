import DebouncedResizeContainer from "@/components/DebouncedResizeContainer";
import Section from "@/components/Section";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
        <div className="flex flex-col gap-6">
            <Section
                title={t('Expected disconnects')}
                actions={
                    <Select defaultValue={displayLod} onValueChange={setDisplayLod}>
                        <SelectTrigger className="w-32 text-dense sm:h-9">
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
                }
            >
                <div className="h-36">
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
            </Section>

            <Section title={t('Unexpected disconnects')}>
                <div className="h-56">
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
            </Section>
        </div>
    );
});

export default memo(TimelineCard);
