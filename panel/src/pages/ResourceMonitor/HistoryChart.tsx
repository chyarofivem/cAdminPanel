import { useEffect, useMemo, useState } from 'react';
import type { ResourceMonitorHistory } from '@shared/resourceMonitorTypes';
import { t } from '@/lib/i18n';
import { formatMs, niceAxis, pickHeaviestSeries } from './utils';

type HistoryChartProps = {
    history: ResourceMonitorHistory;
    thresholdMs: number;
    intervalMinutes: number;
};

const CHART_HEIGHT = 220;
const MARGIN = { top: 16, right: 12, bottom: 28, left: 44 };

const formatClock = (ts: number) => new Date(ts).toLocaleTimeString(window.txBrowserLocale, {
    hour: '2-digit',
    minute: '2-digit',
});

//Tracks the rendered width so the SVG scales with its container (no horizontal scroll)
const useElementWidth = () => {
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
        if (!element) return;
        setWidth(element.clientWidth);
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setWidth(Math.floor(entry.contentRect.width));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);
    return [setElement, width] as const;
};


/**
 * Line chart of the heaviest resources over the last 24 hours, in ms per tick.
 * Plain SVG: thin lines, recessive grid, the threshold as a reference line,
 * a crosshair tooltip on hover and keyboard focus, and a text legend.
 */
export default function HistoryChart({ history, thresholdMs, intervalMinutes }: HistoryChartProps) {
    const [containerRef, width] = useElementWidth();
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const series = useMemo(() => pickHeaviestSeries(history), [history]);
    const points = history.points;

    const layout = useMemo(() => {
        if (!width || points.length < 2) return null;
        const plotWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
        const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
        const minTs = points[0].ts;
        const maxTs = points[points.length - 1].ts;
        const span = Math.max(1, maxTs - minTs);
        let maxValue = thresholdMs * 1.15;
        for (const item of series) {
            for (const value of item.values) {
                if (value !== null && value > maxValue) maxValue = value;
            }
        }
        const axis = niceAxis(maxValue);
        const x = (ts: number) => MARGIN.left + ((ts - minTs) / span) * plotWidth;
        const y = (value: number) => MARGIN.top + plotHeight - (value / axis.max) * plotHeight;

        //A line breaks where a resource is missing or samples were not taken for a while
        const gapMs = Math.max(3 * intervalMinutes * 60_000, 15 * 60_000);
        const paths = series.map((item) => {
            const segments: { d: string; single?: { cx: number; cy: number } }[] = [];
            let current: [number, number][] = [];
            const flush = () => {
                if (current.length === 1) {
                    segments.push({ d: '', single: { cx: current[0][0], cy: current[0][1] } });
                } else if (current.length > 1) {
                    segments.push({ d: current.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('') });
                }
                current = [];
            };
            item.values.forEach((value, index) => {
                if (index > 0 && points[index].ts - points[index - 1].ts > gapMs) flush();
                if (value === null) {
                    flush();
                    return;
                }
                current.push([x(points[index].ts), y(value)]);
            });
            flush();
            return segments;
        });

        const tickCount = width < 420 ? 3 : 5;
        const timeTicks = Array.from({ length: tickCount }, (_, i) => minTs + (span * i) / (tickCount - 1));
        return { plotWidth, plotHeight, axis, x, y, paths, timeTicks };
    }, [width, points, series, thresholdMs, intervalMinutes]);

    const nearestIndex = (clientX: number, rect: DOMRect) => {
        if (!layout) return null;
        const px = clientX - rect.left;
        let best = 0;
        let bestDistance = Infinity;
        points.forEach((point, index) => {
            const distance = Math.abs(layout.x(point.ts) - px);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = index;
            }
        });
        return best;
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!points.length) return;
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setHoverIndex((index) => Math.max(0, (index ?? points.length) - 1));
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            setHoverIndex((index) => Math.min(points.length - 1, (index ?? -1) + 1));
        } else if (event.key === 'Escape') {
            setHoverIndex(null);
        }
    };

    if (points.length < 2 || !series.length) {
        return <p className="text-sm text-muted-foreground">{t('The chart appears after two samples.')}</p>;
    }

    const summary = series
        .map((item) => t('{name} averages {value} ms per tick', { name: item.name, value: formatMs(item.average) }))
        .join('; ');
    const hovered = hoverIndex !== null && layout ? {
        index: hoverIndex,
        px: layout.x(points[hoverIndex].ts),
        ts: points[hoverIndex].ts,
    } : null;
    const thresholdY = layout ? layout.y(thresholdMs) : 0;

    return <div className="flex flex-col gap-4">
        <div
            ref={containerRef}
            className="relative w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text"
            style={{ height: CHART_HEIGHT }}
            tabIndex={0}
            role="group"
            aria-label={t('Ms per tick over time. Use the arrow keys to read each sample.')}
            onKeyDown={onKeyDown}
            onFocus={() => setHoverIndex((index) => index ?? points.length - 1)}
            onBlur={() => setHoverIndex(null)}
            onPointerMove={(event) => setHoverIndex(nearestIndex(event.clientX, event.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setHoverIndex(null)}
        >
            {layout && <svg width={width} height={CHART_HEIGHT} role="img" aria-label={summary} className="block select-none">
                {/* Grid and y axis */}
                {layout.axis.ticks.map((tick) => {
                    const ty = layout.y(tick);
                    return <g key={tick}>
                        <line x1={MARGIN.left} x2={MARGIN.left + layout.plotWidth} y1={ty} y2={ty} className="stroke-hairline" strokeWidth={1} />
                        <text x={MARGIN.left - 8} y={ty} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-micro tabular-nums">
                            {formatMs(tick)}
                        </text>
                    </g>;
                })}
                <text x={4} y={MARGIN.top - 6} className="fill-muted-foreground text-micro">{t('ms')}</text>

                {/* Time axis */}
                {layout.timeTicks.map((ts, index) => <text
                    key={ts}
                    x={layout.x(ts)}
                    y={CHART_HEIGHT - 8}
                    textAnchor={index === 0 ? 'start' : index === layout.timeTicks.length - 1 ? 'end' : 'middle'}
                    className="fill-muted-foreground text-micro tabular-nums"
                >
                    {formatClock(ts)}
                </text>)}

                {/* Threshold reference line */}
                <line
                    x1={MARGIN.left}
                    x2={MARGIN.left + layout.plotWidth}
                    y1={thresholdY}
                    y2={thresholdY}
                    className="stroke-muted-foreground"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                />
                <text x={MARGIN.left + layout.plotWidth} y={thresholdY - 6} textAnchor="end" className="fill-muted-foreground text-micro tabular-nums">
                    {t('Threshold {value} ms', { value: formatMs(thresholdMs) })}
                </text>

                {/* Series */}
                {layout.paths.map((segments, seriesIndex) => <g key={series[seriesIndex].name}>
                    {segments.map((segment, segmentIndex) => segment.single
                        ? <circle key={segmentIndex} cx={segment.single.cx} cy={segment.single.cy} r={2.5} fill={series[seriesIndex].color} />
                        : <path
                            key={segmentIndex}
                            d={segment.d}
                            fill="none"
                            stroke={series[seriesIndex].color}
                            strokeWidth={2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />)}
                </g>)}

                {/* Crosshair */}
                {hovered && <g>
                    <line x1={hovered.px} x2={hovered.px} y1={MARGIN.top} y2={MARGIN.top + layout.plotHeight} className="stroke-muted-foreground" strokeWidth={1} />
                    {series.map((item) => {
                        const value = item.values[hovered.index];
                        if (value === null) return null;
                        return <circle
                            key={item.name}
                            cx={hovered.px}
                            cy={layout.y(value)}
                            r={4}
                            fill={item.color}
                            className="stroke-sidebar"
                            strokeWidth={2}
                        />;
                    })}
                </g>}
            </svg>}

            {/* Tooltip: opposite half from the pointer, anchored to an edge so it never overflows on phones */}
            {hovered && <div
                className="pointer-events-none absolute top-2 z-10 w-max max-w-[min(16rem,75%)] rounded-xs bg-menu px-3 py-2 text-dense shadow-menu"
                style={hovered.px > width / 2
                    ? { left: MARGIN.left + 4 }
                    : { right: MARGIN.right }}
            >
                <p className="mb-1 text-xs tabular-nums text-muted-foreground">{formatClock(hovered.ts)}</p>
                <ul className="flex flex-col gap-1">
                    {series.map((item) => {
                        const value = item.values[hovered.index];
                        return <li key={item.name} className="flex min-w-0 items-center gap-2">
                            <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="shrink-0 font-semibold tabular-nums text-white">
                                {value === null ? t('n/a') : `${formatMs(value)} ms`}
                            </span>
                            <span className="min-w-0 truncate text-muted-foreground">{item.name}</span>
                        </li>;
                    })}
                </ul>
            </div>}
        </div>

        {/* Legend */}
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-dense" aria-label={t('Legend')}>
            {series.map((item) => <li key={item.name} className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="h-0.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 break-all text-body">{item.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{t('{value} ms avg', { value: formatMs(item.average) })}</span>
            </li>)}
        </ul>
    </div>;
}
