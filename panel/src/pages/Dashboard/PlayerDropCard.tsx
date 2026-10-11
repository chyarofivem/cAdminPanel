import { memo, useCallback, useMemo, useState } from 'react';
import { Pie, DatumId, PieCustomLayerProps, ComputedDatum } from '@nivo/pie';
import { numberToLocaleString } from '@/lib/utils';
import { useIsDarkMode } from '@/hooks/theme';
import DebouncedResizeContainer from "@/components/DebouncedResizeContainer";
import Section from '@/components/Section';
import { useAtomValue } from 'jotai';
import { dashPlayerDropAtom, useGetDashDataAge } from './dashboardHooks';
import { playerDropCategories, playerDropCategoryDefaultColor } from '@/lib/playerDropCategories';
import { t } from '@/lib/i18n';


type PlayerDropChartDatum = {
    id: string;
    label: string;
    value: number;
    count: number;
}


type PieCenterTextProps = PieCustomLayerProps<PlayerDropChartDatum> & {
    active?: ComputedDatum<PlayerDropChartDatum>;
};

const PieCenterText = ({ centerX, centerY, dataWithArc, innerRadius, active }: PieCenterTextProps) => {
    if (active) {
        return (<>
            <circle
                cx={centerX}
                cy={centerY}
                r={innerRadius * 0.95}
                fill={active.color}
            />
            <text
                x={centerX}
                y={centerY - 12}
                textAnchor="middle"
                dominantBaseline="central"
                className='text-dense font-semibold'
                opacity={0.75}
            >
                {active.label}:
            </text>
            <text
                x={centerX}
                y={centerY + 10}
                textAnchor="middle"
                dominantBaseline="central"
                className='text-lg font-semibold tabular-nums'
                opacity={0.75}
            >
                {numberToLocaleString(active.data.count)}
            </text>

        </>)
    } else {
        const totalDrops = useMemo(() => dataWithArc.reduce((acc, d) => acc + d.data.count, 0), [dataWithArc]);
        return (<>
            <text
                x={centerX}
                y={centerY - 12}
                textAnchor="middle"
                dominantBaseline="central"
                className='text-dense fill-muted-foreground'
            >
                {t('Total')}:
            </text>
            <text
                x={centerX}
                y={centerY + 10}
                textAnchor="middle"
                dominantBaseline="central"
                className='text-lg font-semibold tabular-nums fill-white'
            >
                {numberToLocaleString(totalDrops)}
            </text>
        </>)
    }
}


type PlayerDropChartProps = {
    data: PlayerDropChartDatum[];
    activeId: DatumId | null;
    setActiveId: (id: DatumId | null) => void;
    width: number;
    height: number;
};

const PlayerDropChart = memo(({ data, activeId, setActiveId, width, height }: PlayerDropChartProps) => {
    const isDarkMode = useIsDarkMode();
    const [hasClicked, setHasClicked] = useState(false);
    const CenterLayer = useCallback((allArgs: PieCustomLayerProps<PlayerDropChartDatum>) => {
        if (!activeId) return PieCenterText(allArgs);
        const active = allArgs.dataWithArc.find(d => d.id === activeId);
        return PieCenterText({ ...allArgs, active });
    }, [activeId]);

    if (!width || !height) return null;
    return (
        <Pie
            data={data}
            height={height}
            width={width}
            theme={{
                text: {
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    fontWeight: 600,
                },
            }}
            activeId={activeId}
            onActiveIdChange={setActiveId}
            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            innerRadius={0.6}
            padAngle={1.75}
            cornerRadius={4}
            activeOuterRadiusOffset={6}
            borderWidth={1}
            borderColor={isDarkMode ? undefined : {
                from: 'data.border',
                // modifiers: [['darker', 0.8]]
            }}
            valueFormat={'.1%'}
            enableArcLinkLabels={false}
            layers={['arcs', 'arcLabels', 'arcLinkLabels', CenterLayer]}
            arcLabelsSkipAngle={20}
            arcLabelsTextColor={{
                from: 'color',
                modifiers: [['darker', 2.5]],
            }}
            onClick={(datum, event) => setHasClicked(curr => !curr)}
            onMouseEnter={(datum, event) => setHasClicked(false)} //resets behavior
            onMouseLeave={(datum, event) => {
                hasClicked && setActiveId(datum.id)
                event.preventDefault()
            }}
            colors={{ datum: 'data.color' }}
            tooltip={() => null}
            sortByValue
        />
    )
});


export default function PlayerDropCard() {
    const [activeId, setActiveId] = useState<DatumId | null>(null)
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
    const playerDropData = useAtomValue(dashPlayerDropAtom);
    const getDashDataAge = useGetDashDataAge();

    const chartData = useMemo(() => {
        if (!playerDropData?.summaryLast6h) return null;
        const dataAge = getDashDataAge();
        if (dataAge.isExpired) return null;
        if (!playerDropData.summaryLast6h.length) return 'not_enough_data';

        const totalDrops = playerDropData.summaryLast6h.reduce((acc, d) => acc + d[1], 0);
        return playerDropData.summaryLast6h.map(([reason, count]) => ({
            id: reason,
            label: playerDropCategories[reason] ? t(playerDropCategories[reason].label) : reason,
            count,
            value: count / totalDrops,
            color: playerDropCategories[reason]?.color ?? playerDropCategoryDefaultColor,
            border: playerDropCategories[reason]?.border ?? playerDropCategoryDefaultColor,
        }));
    }, [playerDropData?.summaryLast6h]);


    const displayLegends = useMemo(() => {
        if (!playerDropData?.summaryLast6h) return null;
        const dataAge = getDashDataAge();
        if (dataAge.isExpired) return null;
        if (!playerDropData.summaryLast6h.length) return null;

        return playerDropData.summaryLast6h.map(([reason, count]) => ({
            id: reason,
            label: playerDropCategories[reason] ? t(playerDropCategories[reason].label) : reason,
            color: playerDropCategories[reason]?.color ?? playerDropCategoryDefaultColor,
            border: playerDropCategories[reason]?.border ?? playerDropCategoryDefaultColor,
        }));
    }, [playerDropData?.summaryLast6h]);


    //Rendering
    let contentNode: React.ReactNode = null;
    if (typeof chartData === 'object' && chartData !== null) {
        contentNode = <PlayerDropChart
            data={chartData}
            activeId={activeId}
            setActiveId={setActiveId}
            width={chartSize.width}
            height={chartSize.height}
        />;
    } else if (typeof chartData === 'string') {
        contentNode = <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
            <p className='max-w-80'>
                {t('No players have disconnected from the server in the last 6 hours.')}
            </p>
        </div>;
    } else {
        contentNode = <div role="status" className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {t('Loading…')}
        </div>;
    }

    return (
        <Section className="min-w-0" title={t('Player drop cause (last 6h)')}>
            <div className="h-56">
                <DebouncedResizeContainer onDebouncedResize={setChartSize}>
                    {contentNode}
                </DebouncedResizeContainer>
            </div>
            {displayLegends && <div className='mt-4 flex flex-wrap justify-center gap-1'>
                {displayLegends.map(legend => {
                    return (
                        <button
                            type="button"
                            key={legend.id}
                            data-active={activeId === legend.id}
                            aria-pressed={activeId === legend.id}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xs px-2 text-dense text-body transition-colors duration-150 hover:bg-raise hover:text-white data-[active=true]:bg-raise-2 data-[active=true]:text-white sm:min-h-8"
                            onClick={() => setActiveId(activeId === legend.id ? null : legend.id)}
                        >
                            <span
                                aria-hidden="true"
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: legend.color }}
                            />
                            {legend.label}
                        </button>
                    )
                })}
            </div>}
        </Section>
    );
}
