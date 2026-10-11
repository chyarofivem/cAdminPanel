import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { RefreshCwIcon } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthedFetcher } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import { getSocket } from '@/lib/utils';
import type {
    TxAdminLogApiResponse,
    TxAdminLogChannel,
    TxAdminLogEntry,
} from '@shared/txAdminLogTypes';

const FIRST_PAGE_PATH = '/api/logs/panel?limit=250';

const mergeEntries = (current: TxAdminLogEntry[], incoming: TxAdminLogEntry[]) => {
    const unique = new Map<string, TxAdminLogEntry>();
    for (const entry of [...current, ...incoming]) unique.set(entry.id, entry);
    return [...unique.values()].sort((left, right) => (
        right.ts - left.ts || right.id.localeCompare(left.id)
    ));
};

//The word carries the channel; server events get the info tint to tell them apart.
const channelBadge: Record<TxAdminLogChannel, BadgeProps['variant']> = {
    action: 'default',
    server: 'info',
};

export default function TxAdminLogPage() {
    const fetcher = useAuthedFetcher();
    const [entries, setEntries] = useState<TxAdminLogEntry[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [channel, setChannel] = useState<'all' | TxAdminLogChannel>('all');
    const [query, setQuery] = useState('');
    const pausedRef = useRef(isPaused);
    const pausedEntriesRef = useRef<TxAdminLogEntry[]>([]);
    const firstPageRequestedAtRef = useRef(0);
    pausedRef.current = isPaused;

    const requestPage = async (path: string) => {
        if (path === FIRST_PAGE_PATH) firstPageRequestedAtRef.current = Date.now();
        const response = await fetcher<TxAdminLogApiResponse & { error?: string }>(path);
        if (response.error) throw new Error(response.error);
        return response;
    };
    const swr = useSWR(FIRST_PAGE_PATH, requestPage, { revalidateOnFocus: false });

    useEffect(() => {
        if (!swr.data) return;
        // A first-page refresh is authoritative for the active daily segment.
        // Preserve only socket entries that arrived while that request was in flight.
        setEntries(current => mergeEntries(
            swr.data!.entries,
            current.filter(entry => entry.ts >= firstPageRequestedAtRef.current),
        ));
        setNextCursor(swr.data.nextCursor);
        setHasMore(swr.data.hasMore);
    }, [swr.data]);

    useEffect(() => {
        const socket = getSocket('serverlog');
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));
        socket.on('logData', incoming => {
            if (pausedRef.current) {
                pausedEntriesRef.current = mergeEntries(pausedEntriesRef.current, incoming).slice(0, 5_000);
            } else {
                setEntries(current => mergeEntries(current, incoming));
            }
        });
        return () => {
            socket.removeAllListeners();
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (isPaused) return;
        if (pausedEntriesRef.current.length) {
            const pending = pausedEntriesRef.current;
            pausedEntriesRef.current = [];
            setEntries(current => mergeEntries(current, pending));
        }
        // Reconcile anything missed while the socket or tab was paused.
        void swr.mutate();
    }, [isPaused]);

    const visibleEntries = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return entries.filter(entry => {
            if (channel !== 'all' && entry.channel !== channel) return false;
            if (!search) return true;
            return [entry.type, entry.src.name, entry.src.id || '', entry.msg]
                .some(value => value.toLocaleLowerCase().includes(search));
        });
    }, [channel, entries, query]);

    const counts = useMemo(() => ({
        all: entries.length,
        action: entries.filter(entry => entry.channel === 'action').length,
        server: entries.filter(entry => entry.channel === 'server').length,
    }), [entries]);

    const loadMore = async () => {
        if (!nextCursor || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const response = await requestPage(
                `/api/logs/panel?limit=250&before=${encodeURIComponent(nextCursor)}`,
            );
            setEntries(current => mergeEntries(current, response.entries));
            setNextCursor(response.nextCursor);
            setHasMore(response.hasMore);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const timeFormatter = useMemo(() => new Intl.DateTimeFormat(window.txBrowserLocale, {
        dateStyle: 'medium',
        timeStyle: 'medium',
    }), []);

    return (
        <section className="flex h-contentvh min-h-[38rem] w-full flex-col pb-6">
            <PageHeader
                title={t('Panel Log')}
                subtitle={t('Server events and administrator actions in one timeline.')}
            >
                <Badge variant={isConnected ? 'success' : 'warning'} aria-live="polite">
                    {isConnected ? t('Live') : t('Reconnecting')}
                </Badge>
                <Badge>{t('24-hour rotation')}</Badge>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    aria-pressed={isPaused}
                    onClick={() => setIsPaused(value => !value)}
                >
                    {isPaused ? t('Resume') : t('Pause')}
                </Button>
                <IconButton
                    label={t('Refresh log')}
                    icon={<RefreshCwIcon />}
                    className="size-11 sm:size-9"
                    disabled={swr.isValidating}
                    onClick={() => void swr.mutate()}
                />
            </PageHeader>

            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Tabs value={channel} onValueChange={value => setChannel(value as typeof channel)} className="min-w-0 max-w-full">
                    <TabsList className="max-w-full">
                        {(['all', 'action', 'server'] as const).map(filter => (
                            <TabsTrigger key={filter} value={filter} className="gap-2">
                                {filter === 'all' ? t('All') : filter === 'action' ? t('Actions') : t('Server events')}
                                <span className="tabular-nums text-muted-foreground">{counts[filter]}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                <Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    aria-label={t('Search message, type, or actor')}
                    placeholder={t('Search message, type, or actor')}
                    className="text-dense sm:h-9 lg:max-w-sm"
                />
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-sunken">
                {swr.isLoading && entries.length === 0 ? (
                    <p role="status" className="p-4 text-sm text-muted-foreground sm:px-6">{t('Loading panel log...')}</p>
                ) : swr.error && entries.length === 0 ? (
                    <p role="alert" className="p-4 text-sm text-danger-text sm:px-6">
                        {swr.error.message || t('The panel log could not be loaded.')}
                    </p>
                ) : visibleEntries.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground sm:px-6">
                        {query || channel !== 'all' ? t('No log entries match these filters.') : t('No panel log entries yet.')}
                    </p>
                ) : (
                    <ol className="divide-y divide-hairline">
                        {visibleEntries.map(entry => (
                            <li key={entry.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[11rem_7rem_minmax(0,1fr)] sm:gap-3 sm:px-6">
                                <time className="font-mono text-xs tabular-nums text-muted-foreground" dateTime={new Date(entry.ts).toISOString()}>
                                    {timeFormatter.format(entry.ts)}
                                </time>
                                <span>
                                    <Badge variant={channelBadge[entry.channel]}>
                                        {entry.channel === 'action' ? t('Action') : t('Server')}
                                    </Badge>
                                </span>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                        <span className="font-medium text-white">{entry.src.name}</span>
                                        <span className="font-mono text-xs text-muted-foreground">{entry.type}</span>
                                        {entry.src.id && <span className="truncate font-mono text-xs text-faint">{entry.src.id}</span>}
                                    </div>
                                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-body">{entry.msg}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>

            <footer className="flex min-h-11 flex-wrap items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
                <span className="tabular-nums">{t('{count} entries shown', { count: visibleEntries.length })}</span>
                {hasMore && (
                    <Button type="button" size="sm" variant="secondary" disabled={isLoadingMore} onClick={() => void loadMore()}>
                        {t('Load older entries')}
                    </Button>
                )}
            </footer>
        </section>
    );
}
