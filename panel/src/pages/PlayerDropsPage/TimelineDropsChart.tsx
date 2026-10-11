import { memo, useEffect, useRef, useState } from "react";
import { useIsDarkMode } from "@/hooks/theme";
import { Button } from "@/components/ui/button";
import drawDropsTimeline, { TimelineDropsDatum } from "./drawDropsTimeline";
import { playerDropCategories } from "@/lib/playerDropCategories";
import { PlayerDropsMessage } from "./PlayerDropsGenericSubcards";
import { DrilldownRangeSelectionType } from "./PlayerDropsPage";
import { t } from "@/lib/i18n";
import './timeline.css';

export type TimelineDropsChartData = {
    displayLod: string;
    startDate: Date;
    endDate: Date;
    maxDrops: number;
    categoriesSorted: string[];
    log: TimelineDropsDatum[];
}

const ChartLabels = memo(({ categories }: { categories: string[] }) => {
    const categoriesReversed = categories.slice().reverse();
    return categoriesReversed.map((catName) => {
        return (
            <div key={catName} className="flex items-center gap-2 text-xs">
                <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: playerDropCategories[catName].color }}
                />
                <span className="text-body">
                    {t(playerDropCategories[catName].label)}:
                </span>
                <div className="ml-auto min-w-[3ch] pl-3 text-right font-semibold tabular-nums text-white">
                    <span data-category={catName} />
                </div>
            </div>
        )
    })
});

type TimelineDropsChartProps = {
    chartData: TimelineDropsChartData;
    chartName: string;
    width: number;
    height: number;
    rangeSelected: DrilldownRangeSelectionType;
    rangeSetter: (range: DrilldownRangeSelectionType) => void;
};

function TimelineDropsChart({ chartData, chartName, width, height, rangeSelected, rangeSetter }: TimelineDropsChartProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const legendRef = useRef<HTMLDivElement>(null);
    const [renderError, setRenderError] = useState('');
    const [errorRetry, setErrorRetry] = useState(0);
    const isDarkMode = useIsDarkMode();
    const margins = {
        top: 8,
        right: 8,
        bottom: 24,
        left: 42,
        axis: 1
    };

    //Redraw chart when data or size changes
    useEffect(() => {
        if (!chartData || !legendRef.current || !svgRef.current || !canvasRef.current || !width || !height) return;
        if (!chartData.log.length) return; //only in case somehow the api returned, but no data found
        try {
            console.groupCollapsed(`Drawing player ${chartName} drops:`);
            console.time(`drawDropsTimeline-${chartName}`);
            drawDropsTimeline({
                chartName,
                legendRef: legendRef.current,
                svgRef: svgRef.current,
                canvasRef: canvasRef.current,
                size: { width, height },
                rangeSelected,
                margins,
                isDarkMode,
                data: chartData,
                setRenderError,
                rangeSetter,
            });
            setErrorRetry(0);
            setRenderError('');
            console.timeEnd(`drawDropsTimeline-${chartName}`);
        } catch (error) {
            setRenderError((error as Error).message ?? t('Unknown error.'));
        } finally {
            console.groupEnd();
        }
    }, [
        chartData,
        chartName,
        width,
        height,
        rangeSelected,
        rangeSetter,
        isDarkMode,
        legendRef,
        svgRef,
        canvasRef,
        renderError
    ]);

    if (!width || !height) return null;
    if (renderError) {
        return <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center text-sm text-danger-text">
            <p>{t('Render Error: {error}', { error: renderError })}</p>
            <Button
                size={'sm'}
                variant={'secondary'}
                onClick={() => {
                    setErrorRetry(c => c + 1);
                    setRenderError('');
                }}
            >
                {t('Retry')}{errorRetry ? ` (${errorRetry})` : ''}
            </Button>
        </div>
    } else if (!chartData.maxDrops) {
        return <PlayerDropsMessage message={t('No players disconnected from your server recently.')} />
    }
    return (<>
        <div
            ref={legendRef}
            style={{
                zIndex: 2,
                position: 'absolute',
                top: `12px`,
                opacity: 0,
            }}
            className="pointer-events-none flex flex-col gap-1 rounded-xs bg-menu px-2.5 py-1.5 shadow-menu transition-opacity duration-150"
        >
            <ChartLabels categories={chartData.categoriesSorted} />
            <div className="change-flag mt-0.5 w-full rounded-xs bg-raise-2 px-1.5 py-0.5 text-center text-xs font-medium text-white" />
        </div>
        <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{
                zIndex: 1,
                position: 'absolute',
                top: '0px',
                left: '0px',
            }}
        />
        <canvas
            ref={canvasRef}
            width={width - margins.left - margins.right}
            height={height - margins.top - margins.bottom}
            style={{
                zIndex: 0,
                position: 'absolute',
                top: `${margins.top}px`,
                left: `${margins.left}px`,
            }}
        />
    </>);
}

export default memo(TimelineDropsChart);
