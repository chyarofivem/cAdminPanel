import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, Gavel, History, Loader2, RotateCw } from 'lucide-react';
import type { HistoryStatsResp, HistoryTableSearchType } from '@shared/historyApiTypes';
import { PageHeader } from '@/components/page-header';
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

function StatCard({ label, value, icon, accent }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
}) {
    return <Card className="overflow-hidden">
        <CardContent className="flex items-center justify-between gap-4 p-4">
            <div><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-2xl font-semibold text-zinc-100">{value.toLocaleString(window.txBrowserLocale)}</p></div>
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
        <PageHeader title={t('History')} icon={<History className="size-6" />} />

        {statsSWR.isLoading && <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Card key={index}><CardContent className="flex h-[86px] items-center justify-center p-4 text-zinc-600"><Loader2 className="size-4 animate-spin" /></CardContent></Card>)}</div>}
        {statsSWR.error && <Card className="mb-4 border-red-500/20 bg-red-500/10"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-red-300">
            <span>{t('History totals could not be loaded: {error}', { error: statsSWR.error.message })}</span>
            <Button variant="outline" size="sm" onClick={() => void statsSWR.mutate()}><RotateCw className="mr-2 size-4" />{t('Try again')}</Button>
        </CardContent></Card>}
        {statsSWR.data && <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('Total warnings')} value={statsSWR.data.totalWarns} icon={<AlertTriangle className="size-5" />} accent="border-amber-500/20 bg-amber-500/10 text-amber-300" />
            <StatCard label={t('Warnings in the last 7 days')} value={statsSWR.data.warnsLast7d} icon={<AlertTriangle className="size-5" />} accent="border-amber-500/20 bg-amber-500/10 text-amber-300" />
            <StatCard label={t('Total bans')} value={statsSWR.data.totalBans} icon={<Gavel className="size-5" />} accent="border-red-500/20 bg-red-500/10 text-red-300" />
            <StatCard label={t('Bans in the last 7 days')} value={statsSWR.data.bansLast7d} icon={<Gavel className="size-5" />} accent="border-red-500/20 bg-red-500/10 text-red-300" />
        </div>}

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
