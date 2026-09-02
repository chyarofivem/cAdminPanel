import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import {
    ActivityIcon,
    CircleIcon,
    Loader2Icon,
    PauseIcon,
    PlayIcon,
    RefreshCwIcon,
    ScrollTextIcon,
    SearchIcon,
    ShieldCheckIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthedFetcher } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import { cn, getSocket } from '@/lib/utils';
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

const channelStyle: Record<TxAdminLogChannel, string> = {
    action: 'border-brand-500/20 bg-brand-500/10 text-brand-400',
    server: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
};

const channelIcon = {
    action: ShieldCheckIcon,
    server: ActivityIcon,
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
        <section className="flex h-contentvh min-h-[38rem] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 shadow-2xl shadow-black/20">
            <header className="border-b border-white/10 bg-gradient-to-r from-brand-950/35 via-zinc-950/80 to-zinc-950 px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-500/20 bg-brand-500/10 text-brand-400">
                            <ScrollTextIcon className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-semibold text-white">{t('Panel Log')}</h1>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                                    {t('24-hour rotation')}
                                </span>
                            </div>
                            <p className="mt-0.5 text-sm text-zinc-500">
                                {t('Server events and administrator actions in one timeline.')}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                            'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs',
                            isConnected
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                : 'border-amber-500/20 bg-amber-500/10 text-amber-300',
                        )}>
                            <CircleIcon className={cn('size-2 fill-current', isConnected && 'animate-pulse')} />
                            {isConnected ? t('Live') : t('Reconnecting')}
                        </span>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setIsPaused(value => !value)}
                        >
                            {isPaused ? <PlayIcon className="mr-2 size-4" /> : <PauseIcon className="mr-2 size-4" />}
                            {isPaused ? t('Resume') : t('Pause')}
                        </Button>
                        <Button type="button" size="icon" variant="outline" onClick={() => void swr.mutate()} aria-label={t('Refresh log')}>
                            <RefreshCwIcon className={cn('size-4', swr.isValidating && 'animate-spin')} />
                        </Button>
                    </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'action', 'server'] as const).map(filter => (
                            <button
                                type="button"
                                key={filter}
                                onClick={() => setChannel(filter)}
                                className={cn(
                                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                                    channel === filter
                                        ? 'border-brand-500/30 bg-brand-500/15 text-brand-300'
                                        : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300',
                                )}
                            >
                                {filter === 'all' ? t('All') : filter === 'action' ? t('Actions') : t('Server events')}
                                <span className="ml-2 font-mono text-[10px] opacity-60">{counts[filter]}</span>
                            </button>
                        ))}
                    </div>
                    <label className="relative block w-full lg:max-w-sm">
                        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                        <Input
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder={t('Search message, type, or actor')}
                            className="border-white/10 bg-black/20 pl-9"
                        />
                    </label>
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-auto">
                {swr.isLoading && entries.length === 0 ? (
                    <div className="grid h-full place-items-center text-zinc-500">
                        <span className="flex items-center gap-3"><Loader2Icon className="size-5 animate-spin" />{t('Loading panel log...')}</span>
                    </div>
                ) : swr.error && entries.length === 0 ? (
                    <div className="grid h-full place-items-center px-6 text-center text-sm text-red-300">
                        {swr.error.message || t('The panel log could not be loaded.')}
                    </div>
                ) : visibleEntries.length === 0 ? (
                    <div className="grid h-full place-items-center px-6 text-center text-sm text-zinc-500">
                        {query || channel !== 'all' ? t('No log entries match these filters.') : t('No panel log entries yet.')}
                    </div>
                ) : (
                    <ol className="divide-y divide-white/[0.06]">
                        {visibleEntries.map(entry => {
                            const EntryIcon = channelIcon[entry.channel];
                            return (
                                <li key={entry.id} className="group grid gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025] sm:grid-cols-[11rem_7rem_minmax(0,1fr)] sm:px-6">
                                    <time className="font-mono text-[11px] text-zinc-600" dateTime={new Date(entry.ts).toISOString()}>
                                        {timeFormatter.format(entry.ts)}
                                    </time>
                                    <span className={cn('inline-flex h-fit w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider', channelStyle[entry.channel])}>
                                        <EntryIcon className="size-3" />
                                        {entry.channel === 'action' ? t('Action') : t('Server')}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                            <span className="font-medium text-zinc-200">{entry.src.name}</span>
                                            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">{entry.type}</span>
                                            {entry.src.id && <span className="truncate font-mono text-[10px] text-zinc-700">{entry.src.id}</span>}
                                        </div>
                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400 group-hover:text-zinc-300">{entry.msg}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>

            <footer className="flex items-center justify-between border-t border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-600 sm:px-6">
                <span>{t('{count} entries shown', { count: visibleEntries.length })}</span>
                {hasMore && (
                    <Button type="button" size="sm" variant="outline" disabled={isLoadingMore} onClick={() => void loadMore()}>
                        {isLoadingMore && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                        {t('Load older entries')}
                    </Button>
                )}
            </footer>
        </section>
    );
}
