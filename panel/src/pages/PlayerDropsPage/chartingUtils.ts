import { PlayerDropsSummaryHour } from "@shared/otherTypes";
import type * as d3 from 'd3';
import { playerDropExpectedCategories, playerDropUnexpectedCategories } from "@/lib/playerDropCategories";
import { TimelineDropsDatum } from "./drawDropsTimeline";
import { DisplayLodType } from "./PlayerDropsPage";

export type PlayerDropsCategoryCount = [category: string, count: number];


/**
 * Colours for chart chrome (gridlines, axes, labels and markers), read from the design
 * tokens in globals.css. Series colours come from playerDropCategories and never follow
 * the accent. Values are concrete strings so they also work as SVG attributes and canvas styles.
 * NOTE: Dashboard/chartingUtils.ts holds the same helper for the performance charts.
 */
export const getChartChromeColors = () => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    return {
        hairline: read('--hairline', 'rgba(255, 255, 255, 0.05)'),
        text: read('--text', '#ffffff'),
        body: read('--text-body', '#d1d5db'),
        muted: read('--text-muted', '#9ca3af'),
    };
};
export type ChartChromeColors = ReturnType<typeof getChartChromeColors>;


/**
 * Restyles a d3 axis group: muted 11px labels in the panel font, hairline domain and ticks.
 * d3 creates new ticks on every `.call(axis)`, so call this again after each one.
 */
export const styleChartAxis = <GDatum, PElement extends d3.BaseType, PDatum>(
    axisGroup: d3.Selection<SVGGElement, GDatum, PElement, PDatum>,
    colors: ChartChromeColors,
) => {
    axisGroup
        .attr('font-family', null)
        .attr('font-size', 11)
        .attr('color', colors.muted);
    axisGroup.selectAll('.domain, .tick line').attr('stroke', colors.hairline);
};

// Helper function to floor a date to the start of the day
const floorToStartOfDay = (dateString: string) => {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
};


/**
 * Processes the player drops summary api data to return the data for the timeline chart.
 * 
 * OBJECTIVES:
 * 1. separate expected and unexpected drops
 * 2. get max drops per expected/unexpected category to size the Y axis'
 * 3. sort the expected/unexpected category by cumulative drops for displaying in consistent order
 */
export const processDropsSummary = (apiData: PlayerDropsSummaryHour[], displayLod: DisplayLodType, windowStart: Date) => {
    const tsWindowStart = windowStart.getTime();
    const windowStartIndex = apiData.findIndex(x => (new Date(x.hour)).getTime() >= tsWindowStart);
    const windowData = apiData.slice(windowStartIndex);
    if (windowData.length === 0) return null;

    //Separate expected and unexpected drops so we can sort the categories by total drops
    const expectedCategoriesDropsTotal = Object.fromEntries(playerDropExpectedCategories.map(cat => [cat, 0]));
    const unexpectedCategoriesDropsTotal = Object.fromEntries(playerDropUnexpectedCategories.map(cat => [cat, 0]));

    //If the LOD is day, bin the data
    let binnedData: PlayerDropsSummaryHour[] = windowData;
    if (displayLod === 'day') {
        binnedData = [];
        let currDayOfMonth;
        let currDayData: PlayerDropsSummaryHour | undefined;
        for (const hourData of windowData) {
            const hourDayOfMonth = (new Date(hourData.hour)).getDate();
            const hourDayStart = floorToStartOfDay(hourData.hour);
            if (!currDayData) {
                currDayOfMonth = hourDayOfMonth;
                currDayData = {
                    hour: hourDayStart,
                    changes: 0,
                    dropTypes: [],
                };
            } else if (hourDayOfMonth !== currDayOfMonth) {
                binnedData.push(currDayData);
                currDayOfMonth = hourDayOfMonth;
                currDayData = {
                    hour: hourDayStart,
                    changes: hourData.changes,
                    dropTypes: structuredClone(hourData.dropTypes),
                };
                continue;
            }

            //Merge the data
            currDayData.changes += hourData.changes;
            for (const [catName, catCount] of hourData.dropTypes.slice()) {
                const currCatCount = currDayData.dropTypes.find(([currCatName]) => currCatName === catName);
                if (currCatCount) {
                    currCatCount[1] += catCount;
                } else {
                    currDayData.dropTypes.push([catName, catCount]);
                }
            }
        }
        //Push the last day
        if (currDayData) binnedData.push(currDayData);
    }

    //Get the max drops per category to size the Y axis
    let expectedSeriesMax = 0;
    let unexpectedSeriesMax = 0;

    //Process the data
    const series = [];
    for (const intervalData of binnedData) {
        const expectedDrops: PlayerDropsCategoryCount[] = [];
        const unexpectedDrops: PlayerDropsCategoryCount[] = [];
        let intervalExpectedTotalDrops = 0;
        let intervalUnexpectedTotalDrops = 0;
        for (const [catName, catCount] of intervalData.dropTypes) {
            if (playerDropExpectedCategories.includes(catName)) {
                intervalExpectedTotalDrops += catCount;
                expectedDrops.push([catName, catCount]);
                expectedCategoriesDropsTotal[catName] += catCount;
            } else {
                intervalUnexpectedTotalDrops += catCount;
                unexpectedDrops.push([catName, catCount]);
                unexpectedCategoriesDropsTotal[catName] += catCount;
            }
        }
        expectedSeriesMax = Math.max(expectedSeriesMax, intervalExpectedTotalDrops);
        unexpectedSeriesMax = Math.max(unexpectedSeriesMax, intervalUnexpectedTotalDrops);
        series.push({
            changes: intervalData.changes,
            expectedDrops: expectedDrops,
            unexpectedDrops: unexpectedDrops,
        });
    }

    //Sort categories by total drops
    const expectedCategoriesSorted = Object.entries(expectedCategoriesDropsTotal)
        .sort((a, b) => b[1] - a[1]);
    const expectedCategoriesOrder = Object.fromEntries(
        expectedCategoriesSorted.map(([cat, _], index) => [cat, index])
    );
    const unexpectedCategoriesSorted = Object.entries(unexpectedCategoriesDropsTotal)
        .sort((a, b) => b[1] - a[1]);
    const unexpectedCategoriesOrder = Object.fromEntries(
        unexpectedCategoriesSorted.map(([cat, _], index) => [cat, index])
    );

    //Separate the series and sort drops by category
    const expectedSeries: TimelineDropsDatum[] = [];
    const unexpectedSeries: TimelineDropsDatum[] = [];
    for (let i = 0; i < binnedData.length; i++) {
        const intervalData = binnedData[i];
        const seriesData = series[i];
        if (!seriesData) continue;
        const currIntervalStart = new Date(intervalData.hour);
        expectedSeries.push({
            startDate: currIntervalStart,
            changes: seriesData.changes,
            drops: seriesData.expectedDrops.sort(([aCat], [bCat]) => {
                return expectedCategoriesOrder[aCat] - expectedCategoriesOrder[bCat];
            }),
        });
        unexpectedSeries.push({
            startDate: currIntervalStart,
            changes: seriesData.changes,
            drops: seriesData.unexpectedDrops.sort(([aCat], [bCat]) => {
                return unexpectedCategoriesOrder[aCat] - unexpectedCategoriesOrder[bCat];
            }),
        });
    }

    return {
        expectedSeries: expectedSeries,
        expectedSeriesMax: expectedSeriesMax,
        expectedCategoriesSorted: expectedCategoriesSorted.map(([cat, _]) => cat),
        unexpectedSeries: unexpectedSeries,
        unexpectedSeriesMax: unexpectedSeriesMax,
        unexpectedCategoriesSorted: unexpectedCategoriesSorted.map(([cat, _]) => cat),
    };
}
