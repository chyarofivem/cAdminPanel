import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Link } from 'wouter';
import type { HistoryStatsResp, HistoryTableSearchType } from '@shared/historyApiTypes';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/page-header';
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

function Stat({ label, value }: { label: string; value?: number }) {
    return <div className="min-w-0">
        <dt className="text-dense text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-lg font-semibold tabular-nums text-white">
            {value === undefined
                ? <span aria-hidden="true" className="inline-block h-6 w-12 rounded-xs bg-raise-2 align-middle" />
                : value.toLocaleString(window.txBrowserLocale)}
        </dd>
    </div>;
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

    const stats = statsSWR.data;
    const showStats = statsSWR.isLoading || Boolean(stats);

    return <div className="w-full pb-6">
        <PageHeader title={t('History')} subtitle={t('Search and review moderation activity across the server.')}>
            <Button variant="secondary" size="sm" asChild>
                <Link href="/settings/ban-templates">{t('Ban Templates')}</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
                <Link href="/system/master-actions#cleandb">{t('Bulk Remove')}</Link>
            </Button>
            <Button variant="secondary" size="sm" disabled={statsSWR.isLoading} onClick={() => void statsSWR.mutate()}>
                {t('Refresh totals')}
            </Button>
        </PageHeader>

        <div className="flex flex-col gap-6">
            {showStats && <dl
                aria-busy={statsSWR.isLoading}
                className="grid grid-cols-2 gap-4 rounded-lg bg-raise p-4 sm:p-6 lg:grid-cols-4"
            >
                <Stat label={t('Total warnings')} value={stats?.totalWarns} />
                <Stat label={t('Warnings in the last 7 days')} value={stats?.warnsLast7d} />
                <Stat label={t('Total bans')} value={stats?.totalBans} />
                <Stat label={t('Bans in the last 7 days')} value={stats?.bansLast7d} />
            </dl>}

            {statsSWR.error && <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
                <AlertDescription>{t('History totals could not be loaded: {error}', { error: statsSWR.error.message })}</AlertDescription>
                <Button variant="secondary" size="sm" onClick={() => void statsSWR.mutate()}>{t('Try again')}</Button>
            </Alert>}

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
        </div>
    </div>;
}
