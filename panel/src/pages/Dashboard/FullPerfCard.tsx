import React, { ReactNode, memo, useEffect, useMemo, useRef, useState } from 'react';
import DebouncedResizeContainer from '@/components/DebouncedResizeContainer';
import drawFullPerfChart from './drawFullPerfChart';
import { useBackendApi } from '@/hooks/fetch';
import type { PerfChartApiResp, PerfChartApiSuccessResp } from "@shared/otherTypes";
import useSWR from 'swr';
import { PerfSnapType, formatTickBoundary, getBucketTicketsEstimatedTime, getServerStatsData, getTimeWeightedHistogram, processPerfLog } from './chartingUtils';
import { dashServerStatsAtom, useThrottledSetCursor } from './dashboardHooks';
import { useIsDarkMode } from '@/hooks/theme';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Section from '@/components/Section';
import { useSetAtom } from 'jotai';
import { t } from '@/lib/i18n';


type FullPerfChartProps = {
    threadName: string;
    apiData: PerfChartApiSuccessResp;
    apiDataAge: number;
    width: number;
    height: number;
    isDarkMode: boolean;
};

const FullPerfChart = memo(({ threadName, apiData, apiDataAge, width, height, isDarkMode }: FullPerfChartProps) => {
    const setServerStats = useSetAtom(dashServerStatsAtom);
    const svgRef = useRef<SVGSVGElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [renderError, setRenderError] = useState('');
    const [errorRetry, setErrorRetry] = useState(0);
    const setCursor = useThrottledSetCursor();
    const margins = {
        top: 8,
        right: 50,
        bottom: 30,
        left: 40,
        axis: 1
    };

    //Process data only once
    const processedData = useMemo(() => {
        if (!apiData) return null;
        const parsed = processPerfLog(apiData.threadPerfLog, (perfLog) => {
            const bucketTicketsEstimatedTime = getBucketTicketsEstimatedTime(apiData.boundaries);
            return getTimeWeightedHistogram(
                perfLog.buckets,
                bucketTicketsEstimatedTime
            );
        });
        if (!parsed) return null;

        return {
            ...parsed,
            bucketLabels: apiData.boundaries.map(formatTickBoundary),
            cursorSetter: (snap: PerfSnapType | undefined) => {
                if (!snap) return setCursor(undefined);
                setCursor({
                    threadName,
                    snap,
                });
            },
        }
    }, [apiData, apiDataAge, threadName, isDarkMode, renderError]);

    //Update server stats when data changes
    useEffect(() => {
        if (!processedData) {
            setServerStats(undefined);
        } else {
            const serverStatsData = getServerStatsData(processedData.lifespans, 24, apiDataAge);
            setServerStats(serverStatsData);
        }
    }, [processedData, apiDataAge]);


    //Redraw chart when data or size changes
    useEffect(() => {
        if (!processedData || !svgRef.current || !canvasRef.current || !width || !height) return;
        if (!processedData.lifespans.length) return; //only in case somehow the api returned, but no data found
        try {
            console.groupCollapsed('Drawing full performance chart:');
            console.time('drawFullPerfChart');
            drawFullPerfChart({
                svgRef: svgRef.current,
                canvasRef: canvasRef.current,
                setRenderError,
                size: { width, height },
                margins,
                isDarkMode,
                ...processedData,
            });
            setErrorRetry(0);
            setRenderError('');
            console.timeEnd('drawFullPerfChart');
        } catch (error) {
            setRenderError((error as Error).message ?? 'Unknown error.');
        } finally {
            console.groupEnd();
        }
    }, [processedData, width, height, svgRef, canvasRef, renderError]);


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
    }
    return (<>
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
});

function ChartErrorMessage({ error }: { error: Error | string }) {
    const errorMessageMaps: Record<string, ReactNode> = {
        bad_request: t('Chart data loading failed: bad request.'),
        invalid_thread_name: t('Chart data loading failed: invalid thread name.'),
        data_unavailable: t('Chart data loading failed: data not yet available.'),
        not_enough_data: (<>
            <p className='font-medium text-white'>{t('There is not enough data to display the chart just yet.')}</p>
            <p className='mt-1'>
                {t('The chart requires at least 30 minutes of server runtime data to be available.')}
            </p>
        </>),
    };

    if (typeof error === 'string') {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
                {errorMessageMaps[error] ?? t('Unknown backend error')}
            </div>
        );
    } else {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-sm text-danger-text">
                {t('Error')}: {error.message ?? t('Unknown error')}
            </div>
        );
    }
}


export default function FullPerfCard() {
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
    const [selectedThread, setSelectedThread] = useState('svMain');
    const [apiFailReason, setApiFailReason] = useState('');
    const [apiDataAge, setApiDataAge] = useState(0);
    const isDarkMode = useIsDarkMode();

    const chartApi = useBackendApi<PerfChartApiResp>({
        method: 'GET',
        path: `/perfChartData/:thread/`,
    });

    const swrChartApiResp = useSWR(`/perfChartData/${selectedThread}`, async () => {
        setApiFailReason('');
        const data = await chartApi({
            pathParams: { thread: selectedThread },
        });
        if (!data) throw new Error('empty_response');
        if ('fail_reason' in data) {
            setApiFailReason(data.fail_reason);
            return null;
        }
        setApiDataAge(Date.now());
        return data;
    }, {
        //the data min interval is 5 mins, so we can safely cache for 1 min
        revalidateOnMount: true,
        revalidateOnFocus: false,
        refreshInterval: 60 * 1000,
    });

    //Rendering
    let contentNode: React.ReactNode = null;
    if (swrChartApiResp.data) {
        contentNode = <FullPerfChart
            threadName={selectedThread}
            apiData={swrChartApiResp.data as PerfChartApiSuccessResp}
            apiDataAge={apiDataAge}
            width={chartSize.width}
            height={chartSize.height}
            isDarkMode={isDarkMode}
        />;
    } else if (swrChartApiResp.isLoading) {
        contentNode = <div role="status" className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {t('Loading…')}
        </div>;
    } else if (apiFailReason || swrChartApiResp.error) {
        contentNode = <ChartErrorMessage error={apiFailReason || swrChartApiResp.error} />;
    }

    return (
        <Section
            title={t('Performance history')}
            actions={
                <Select defaultValue={selectedThread} onValueChange={setSelectedThread}>
                    <SelectTrigger className="w-36 text-dense sm:h-9" aria-label={t('Select thread')}>
                        <SelectValue placeholder={t('Select thread')} />
                    </SelectTrigger>
                    <SelectContent className="px-0">
                        <SelectItem value={'svMain'} className="cursor-pointer">
                            svMain
                        </SelectItem>
                        <SelectItem value={'svSync'} className="cursor-pointer">
                            svSync
                        </SelectItem>
                        <SelectItem value={'svNetwork'} className="cursor-pointer">
                            svNetwork
                        </SelectItem>
                    </SelectContent>
                </Select>
            }
        >
            <div className="h-80 md:h-96">
                <DebouncedResizeContainer onDebouncedResize={setChartSize}>
                    {contentNode}
                </DebouncedResizeContainer>
            </div>
        </Section>
    );
}
