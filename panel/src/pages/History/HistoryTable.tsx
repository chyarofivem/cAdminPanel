import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle, ArrowDown, ArrowUp, Ban, CalendarDays, CheckCircle2,
    Clock3, Gavel, Hourglass, Loader2, RotateCcw, ShieldOff, UserRound,
} from 'lucide-react';
import type {
    HistoryTableActionType,
    HistoryTableSearchResp,
    HistoryTableSearchType,
    HistoryTableSortingType,
} from '@shared/historyApiTypes';
import { useBackendApi } from '@/hooks/fetch';
import { useOpenActionModal } from '@/hooks/actionModal';
import { tsToDate, tsToLocaleTimeString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SEARCH_ANY_STRING } from './HistorySearchBox';

type HistoryTableProps = {
    search: HistoryTableSearchType;
    filterbyType?: string;
    filterbyAdmin?: string;
};

const initialSort = (): HistoryTableSortingType => ({
    key: 'timestamp',
    desc: new URLSearchParams(window.location.search).get('sort') !== 'oldest',
});

const statusDetails = (action: HistoryTableActionType) => {
    if (action.isRevoked) return {
        label: t('Revoked'),
        icon: <RotateCcw className="size-3" />,
        className: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
    };
    if (action.type === 'ban') {
        if (action.banExpiration === 'permanent') return {
            label: t('Permanent'),
            icon: <ShieldOff className="size-3" />,
            className: 'border-red-500/20 bg-red-500/10 text-red-300',
        };
        if (action.banExpiration === 'expired') return {
            label: t('Expired'),
            icon: <Clock3 className="size-3" />,
            className: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
        };
        return {
            label: t('Active'),
            icon: <Clock3 className="size-3" />,
            className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
        };
    }
    if (!action.warnAcked) return {
        label: t('Awaiting acknowledgement'),
        icon: <Hourglass className="size-3" />,
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    };
    return {
        label: t('Acknowledged'),
        icon: <CheckCircle2 className="size-3" />,
        className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    };
};

function TimelineAction({ action, onOpen }: { action: HistoryTableActionType; onOpen: () => void }) {
    const status = statusDetails(action);
    const isBan = action.type === 'ban';
    return <li className="relative pl-9 sm:pl-12">
        <span className={cn(
            'absolute left-[0.42rem] top-6 z-[1] flex size-7 items-center justify-center rounded-full border ring-4 ring-[#0d1015] sm:left-[0.8rem]',
            isBan ? 'border-red-500/30 bg-red-500/15 text-red-300' : 'border-amber-500/30 bg-amber-500/15 text-amber-300',
        )}>{isBan ? <Gavel className="size-3.5" /> : <AlertTriangle className="size-3.5" />}</span>
        <button
            type="button"
            onClick={onOpen}
            className="group w-full rounded-2xl border border-white/5 bg-white/[0.035] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand-500/20 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 motion-reduce:transform-none motion-reduce:transition-none"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={isBan ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}>
                            {isBan ? t('Ban') : t('Warning')}
                        </Badge>
                        <Badge variant="outline" className={cn('gap-1', status.className)}>{status.icon}{status.label}</Badge>
                        <span className="font-mono text-[11px] tracking-wider text-zinc-600 group-hover:text-zinc-400">{action.id}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
                        <UserRound className="size-4 text-zinc-600" />
                        <span className="truncate">{action.playerName || t('Unknown player')}</span>
                    </div>
                </div>
                <time className="shrink-0 text-xs text-zinc-500" dateTime={tsToDate(action.timestamp).toISOString()}>
                    {tsToLocaleTimeString(action.timestamp)}
                </time>
            </div>
            <p className="mt-3 line-clamp-2 break-words text-sm leading-relaxed text-zinc-400">{action.reason}</p>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-xs text-zinc-600">
                <span>{t('Issued by {author}', { author: action.author })}</span>
                <span className="text-brand-500/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{t('View details')}</span>
            </div>
        </button>
    </li>;
}

export default function HistoryTable({ search, filterbyType, filterbyAdmin }: HistoryTableProps) {
    const [history, setHistory] = useState<HistoryTableActionType[]>([]);
    const [hasReachedEnd, setHasReachedEnd] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [loadError, setLoadError] = useState<string>();
    const [sorting, setSorting] = useState<HistoryTableSortingType>(initialSort);
    const requestGeneration = useRef(0);
    const historyRef = useRef<HistoryTableActionType[]>([]);
    const isFetchingRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const openActionModal = useOpenActionModal();
    const historyListingApi = useBackendApi<HistoryTableSearchResp>({
        method: 'GET',
        path: '/history/search',
        abortOnUnmount: true,
    });
    const historyListingApiRef = useRef(historyListingApi);
    historyListingApiRef.current = historyListingApi;

    const fetchNextPage = useCallback(async (reset = false) => {
        if (isFetchingRef.current && !reset) return;
        const generation = reset ? ++requestGeneration.current : requestGeneration.current;
        isFetchingRef.current = true;
        setIsFetching(true);
        setLoadError(undefined);
        if (reset) setIsResetting(true);
        try {
            const queryParams: Record<string, string | number | boolean> = {
                sortingKey: sorting.key,
                sortingDesc: sorting.desc,
            };
            if (search.value) {
                queryParams.searchValue = search.value;
                queryParams.searchType = search.type;
            }
            if (filterbyType && filterbyType !== SEARCH_ANY_STRING) queryParams.filterbyType = filterbyType;
            if (filterbyAdmin && filterbyAdmin !== SEARCH_ANY_STRING) queryParams.filterbyAdmin = filterbyAdmin;
            const currentHistory = reset ? [] : historyRef.current;
            if (currentHistory.length) {
                const last = currentHistory[currentHistory.length - 1];
                queryParams.offsetParam = last.timestamp;
                queryParams.offsetActionId = last.id;
            }
            const response = await historyListingApiRef.current({ queryParams });
            if (generation !== requestGeneration.current) return;
            if (!response) throw new Error(t('Request failed.'));
            if ('error' in response) throw new Error(response.error);
            const nextHistory = reset ? response.history : [...historyRef.current, ...response.history];
            historyRef.current = nextHistory;
            setHistory(nextHistory);
            setHasReachedEnd(response.hasReachedEnd);
        } catch (error) {
            if (generation === requestGeneration.current) {
                if (reset) {
                    historyRef.current = [];
                    setHistory([]);
                }
                setLoadError(error instanceof Error ? error.message : t('Request failed.'));
            }
        } finally {
            if (generation === requestGeneration.current) {
                setIsFetching(false);
                isFetchingRef.current = false;
                setIsResetting(false);
            }
        }
    }, [filterbyAdmin, filterbyType, search, sorting]);

    useEffect(() => {
        void fetchNextPage(true);
    }, [search, filterbyType, filterbyAdmin, sorting]);

    useEffect(() => {
        const target = sentinelRef.current;
        if (!target || hasReachedEnd || isFetching || loadError) return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) void fetchNextPage();
        }, { rootMargin: '280px 0px' });
        observer.observe(target);
        return () => observer.disconnect();
    }, [fetchNextPage, hasReachedEnd, isFetching, loadError]);

    const grouped = useMemo(() => {
        const groups = new Map<string, { label: string; actions: HistoryTableActionType[] }>();
        history.forEach(action => {
            const date = tsToDate(action.timestamp);
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const group = groups.get(key) ?? {
                label: date.toLocaleDateString(window.txBrowserLocale, { dateStyle: 'full' }),
                actions: [],
            };
            group.actions.push(action);
            groups.set(key, group);
        });
        return [...groups.values()];
    }, [history]);

    const toggleSort = () => {
        setSorting(current => {
            const next = { ...current, desc: !current.desc };
            const url = new URL(window.location.href);
            if (next.desc) url.searchParams.delete('sort');
            else url.searchParams.set('sort', 'oldest');
            window.history.replaceState({}, '', url);
            return next;
        });
    };

    return <section className="mt-4 pb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-500"><CalendarDays className="size-4" />{t('{count} loaded actions', { count: history.length })}</div>
            <Button variant="outline" size="sm" onClick={toggleSort} disabled={isResetting}>
                {sorting.desc ? <ArrowDown className="mr-2 size-4" /> : <ArrowUp className="mr-2 size-4" />}
                {sorting.desc ? t('Newest first') : t('Oldest first')}
            </Button>
        </div>

        {isResetting && !history.length && <Card><CardContent className="flex items-center justify-center gap-2 p-14 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />{t('Loading history...')}</CardContent></Card>}
        {!isResetting && loadError && !history.length && <Card className="border-red-500/20 bg-red-500/10"><CardContent className="flex flex-col items-center p-10 text-center text-sm text-red-300">
            <Ban className="mb-3 size-6" /><p>{loadError}</p><Button variant="outline" className="mt-4" onClick={() => void fetchNextPage(true)}>{t('Try again')}</Button>
        </CardContent></Card>}
        {!isResetting && !loadError && hasReachedEnd && !history.length && <Card><CardContent className="flex flex-col items-center p-12 text-center text-zinc-500">
            <Clock3 className="mb-3 size-7" /><p className="font-medium text-zinc-300">{t('No actions found')}</p><p className="mt-1 text-sm">{t('Adjust the search or filters to inspect another part of the activity log.')}</p>
        </CardContent></Card>}

        <div className={cn('space-y-7 transition-opacity duration-200', isResetting && 'opacity-40')}>
            {grouped.map(group => <section key={group.label} className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
                <h2 className="mb-3 ml-9 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 sm:ml-12">{group.label}</h2>
                <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-gradient-to-b before:from-brand-500/35 before:via-white/10 before:to-transparent sm:before:left-[1.65rem]">
                    {group.actions.map(action => <TimelineAction key={action.id} action={action} onOpen={() => openActionModal(action.id)} />)}
                </ol>
            </section>)}
        </div>

        <div ref={sentinelRef} className="flex min-h-16 items-center justify-center pt-5 text-center text-sm text-zinc-500">
            {isFetching && !isResetting && <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{t('Loading more actions...')}</span>}
            {loadError && history.length > 0 && <div><p className="text-red-300">{loadError}</p><Button variant="ghost-muted" size="sm" className="mt-2" onClick={() => void fetchNextPage()}>{t('Try again')}</Button></div>}
            {hasReachedEnd && history.length > 0 && <span>{t('You have reached the end of the activity log.')}</span>}
        </div>
    </section>;
}
