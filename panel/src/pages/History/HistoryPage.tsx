import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Activity, AlertTriangle, Gavel, History, Loader2, RotateCw } from 'lucide-react';
import type { HistoryStatsResp, HistoryTableSearchType } from '@shared/historyApiTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthedFetcher } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import {
    HistorySearchBox,
    type HistorySearchBoxReturnStateType,
    SEARCH_ANY_STRING,
    availableSearchTypes,
} from './HistorySearchBox';
import HistoryTable from './HistoryTable';

const updateUrlSearchParams = (
    search: HistoryTableSearchType,
    filterbyType?: string,
    filterbyAdmin?: string,
) => {
    const url = new URL(window.location.href);
    if (search.value) {
        url.searchParams.set('searchType', search.type);
        url.searchParams.set('searchQuery', search.value);
    } else {
        url.searchParams.delete('searchType');
        url.searchParams.delete('searchQuery');
    }
    if (filterbyType && filterbyType !== SEARCH_ANY_STRING) url.searchParams.set('filterbyType', filterbyType);
    else url.searchParams.delete('filterbyType');
    if (filterbyAdmin && filterbyAdmin !== SEARCH_ANY_STRING) url.searchParams.set('filterbyAdmin', filterbyAdmin);
    else url.searchParams.delete('filterbyAdmin');
    window.history.replaceState({}, '', url);
};

const getInitialState = (): HistorySearchBoxReturnStateType => {
    const params = new URLSearchParams(window.location.search);
    const searchType = params.get('searchType');
    const searchQuery = params.get('searchQuery') ?? '';
    const validSearchType = availableSearchTypes.some(type => type.value === searchType)
        ? searchType!
        : availableSearchTypes[0].value;
    return {
        search: { type: validSearchType, value: searchQuery },
        filterbyType: params.get('filterbyType') ?? SEARCH_ANY_STRING,
        filterbyAdmin: params.get('filterbyAdmin') ?? SEARCH_ANY_STRING,
    };
};

function StatCard({ label, value, icon, accent, delay }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
    delay: number;
}) {
    return <Card
        className="animate-in overflow-hidden border-white/5 bg-black/15 shadow-none fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
        style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
        <CardContent className="flex items-center justify-between gap-3 p-3.5">
            <div><p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">{value.toLocaleString(window.txBrowserLocale)}</p></div>
            <div className={`rounded-xl border p-2.5 ${accent}`}>{icon}</div>
        </CardContent>
    </Card>;
}

export default function HistoryPage() {
    const fetcher = useAuthedFetcher();
    const initialState = useMemo(getInitialState, []);
    const [searchState, setSearchState] = useState<HistorySearchBoxReturnStateType>(initialState);
    const statsSWR = useSWR('/history/stats', async url => {
        const response = await fetcher<HistoryStatsResp>(url);
        if ('error' in response) throw new Error(response.error);
        return response;
    }, { revalidateOnFocus: false });

    const doSearch = useCallback((search: HistoryTableSearchType, filterbyType?: string, filterbyAdmin?: string) => {
        const next = { search, filterbyType, filterbyAdmin };
        setSearchState(next);
        updateUrlSearchParams(search, filterbyType, filterbyAdmin);
    }, []);

    return <div className="w-full pb-6">
        <header className="relative mb-5 mt-6 overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-brand-950/40 via-white/[0.035] to-transparent p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-brand-500/[0.08] blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 p-2.5 text-brand-400"><History className="size-5" /></div>
                    <div><h1 className="text-2xl font-semibold text-zinc-100">{t('History')}</h1><p className="mt-1 text-sm text-zinc-400">{t('Search and review moderation activity across the server.')}</p></div>
                </div>
                <Button variant="outline" size="sm" disabled={statsSWR.isLoading} onClick={() => void statsSWR.mutate()}>
                    <RotateCw className={`mr-2 size-4 ${statsSWR.isValidating ? 'animate-spin' : ''}`} />{t('Refresh totals')}
                </Button>
            </div>

            {statsSWR.isLoading && <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Card key={index} className="border-white/5 bg-black/15"><CardContent className="flex h-[78px] items-center justify-center p-4 text-zinc-600"><Loader2 className="size-4 animate-spin" /></CardContent></Card>)}</div>}
            {statsSWR.data && <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label={t('Total warnings')} value={statsSWR.data.totalWarns} icon={<AlertTriangle className="size-4" />} accent="border-amber-500/20 bg-amber-500/10 text-amber-300" delay={0} />
                <StatCard label={t('Warnings in the last 7 days')} value={statsSWR.data.warnsLast7d} icon={<Activity className="size-4" />} accent="border-amber-500/20 bg-amber-500/10 text-amber-300" delay={60} />
                <StatCard label={t('Total bans')} value={statsSWR.data.totalBans} icon={<Gavel className="size-4" />} accent="border-red-500/20 bg-red-500/10 text-red-300" delay={120} />
                <StatCard label={t('Bans in the last 7 days')} value={statsSWR.data.bansLast7d} icon={<Activity className="size-4" />} accent="border-red-500/20 bg-red-500/10 text-red-300" delay={180} />
            </div>}
        </header>

        {statsSWR.error && <Card className="mb-4 border-red-500/20 bg-red-500/10"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-red-300">
            <span>{t('History totals could not be loaded: {error}', { error: statsSWR.error.message })}</span>
            <Button variant="outline" size="sm" onClick={() => void statsSWR.mutate()}><RotateCw className="mr-2 size-4" />{t('Try again')}</Button>
        </CardContent></Card>}

        <HistorySearchBox
            doSearch={doSearch}
            initialState={initialState}
            adminStats={statsSWR.data?.groupedByAdmins ?? []}
        />
        <HistoryTable
            search={searchState.search}
            filterbyType={searchState.filterbyType}
            filterbyAdmin={searchState.filterbyAdmin}
        />
    </div>;
}
