import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ListRow, ListRows } from '@/components/ListRow';
import EmptyState from '@/components/EmptyState';
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

const statusDetails = (action: HistoryTableActionType): { label: string; variant: BadgeProps['variant'] } => {
    if (action.isRevoked) return { label: t('Revoked'), variant: 'default' };
    if (action.type === 'ban') {
        if (action.banExpiration === 'permanent') return { label: t('Permanent'), variant: 'danger' };
        if (action.banExpiration === 'expired') return { label: t('Expired'), variant: 'default' };
        return { label: t('Active'), variant: 'warning' };
    }
    if (!action.warnAcked) return { label: t('Awaiting acknowledgement'), variant: 'warning' };
    return { label: t('Acknowledged'), variant: 'success' };
};

const TimelineAction = memo(function TimelineAction({ action, onOpen }: {
    action: HistoryTableActionType;
    onOpen: (actionId: string) => void;
}) {
    const status = statusDetails(action);
    const isBan = action.type === 'ban';
    return <ListRow interactive className="p-0 sm:px-0">
        <button
            type="button"
            onClick={() => onOpen(action.id)}
            className="flex w-full min-w-0 flex-col gap-2 rounded-lg px-4 py-3 text-left sm:px-5"
        >
            <div className="flex w-full items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="max-w-full truncate text-sm font-medium text-white">{action.playerName || t('Unknown player')}</span>
                    <Badge>{isBan ? t('Ban') : t('Warning')}</Badge>
                    <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <time className="shrink-0 text-dense tabular-nums text-muted-foreground" dateTime={tsToDate(action.timestamp).toISOString()}>
                    {tsToLocaleTimeString(action.timestamp)}
                </time>
            </div>
            <p className="line-clamp-2 break-words text-sm text-body">{action.reason}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-dense text-muted-foreground">
                <span>{t('Issued by {author}', { author: action.author })}</span>
                <span className="font-mono text-xs">{action.id}</span>
            </div>
        </button>
    </ListRow>;
});

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

    return <section aria-label={t('History')} className="flex flex-col gap-6 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-dense tabular-nums text-muted-foreground">{t('{count} loaded actions', { count: history.length })}</p>
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => void fetchNextPage(true)} disabled={isResetting}>
                    {t('Refresh activity')}
                </Button>
                <Button variant="secondary" size="sm" onClick={toggleSort} disabled={isResetting}>
                    {sorting.desc ? t('Newest first') : t('Oldest first')}
                </Button>
            </div>
        </div>

        {isResetting && !history.length && <p role="status" className="text-sm text-muted-foreground">{t('Loading history...')}</p>}
        {!isResetting && loadError && !history.length && <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
            <AlertDescription>{loadError}</AlertDescription>
            <Button variant="secondary" size="sm" onClick={() => void fetchNextPage(true)}>{t('Try again')}</Button>
        </Alert>}
        {!isResetting && !loadError && hasReachedEnd && !history.length && <EmptyState message={t('No actions found')} />}

        {grouped.length > 0 && <div
            aria-busy={isResetting}
            className={cn('flex flex-col gap-6 transition-opacity duration-150', isResetting && 'opacity-40')}
        >
            {grouped.map(group => <section key={group.label} className="flex flex-col gap-3">
                <h2 className="text-base font-semibold text-white">{group.label}</h2>
                <ListRows>
                    {group.actions.map(action => <TimelineAction key={action.id} action={action} onOpen={openActionModal} />)}
                </ListRows>
            </section>)}
        </div>}

        <div ref={sentinelRef} className="flex min-h-16 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            {isFetching && !isResetting && <span role="status">{t('Loading more actions...')}</span>}
            {loadError && history.length > 0 && <>
                <p className="text-danger-text">{loadError}</p>
                <Button variant="secondary" size="sm" onClick={() => void fetchNextPage()}>{t('Try again')}</Button>
            </>}
            {hasReachedEnd && history.length > 0 && <span>{t('You have reached the end of the activity log.')}</span>}
        </div>
    </section>;
}
