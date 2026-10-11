import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import type { HistoryTableSearchType } from '@shared/historyApiTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/auth';
import { t } from '@/lib/i18n';

export const availableSearchTypes = [
    { value: 'actionId', label: 'Action ID', placeholder: 'XXXX-XXXX', description: 'Search actions by their ID.' },
    { value: 'reason', label: 'Reason', placeholder: 'Enter part of the reason to search for', description: 'Search actions by their reason contents.' },
    { value: 'identifiers', label: 'Player IDs', placeholder: 'License, Discord, Steam, etc.', description: 'Search actions by their player IDs separated by a comma.' },
] as const;

export const SEARCH_ANY_STRING = '!any';

export type HistorySearchBoxReturnStateType = {
    search: HistoryTableSearchType;
    filterbyType?: string;
    filterbyAdmin?: string;
};

type HistorySearchBoxProps = {
    doSearch: (search: HistoryTableSearchType, filterbyType?: string, filterbyAdmin?: string) => void;
    initialState: HistorySearchBoxReturnStateType;
    adminStats: { name: string; actions: number }[];
};

export function HistorySearchBox({ doSearch, initialState, adminStats }: HistorySearchBoxProps) {
    const { authData } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<number>();
    const hasMountedRef = useRef(false);
    const [query, setQuery] = useState(initialState.search.value);
    const [searchType, setSearchType] = useState(initialState.search.type);
    const [typeFilter, setTypeFilter] = useState(initialState.filterbyType ?? SEARCH_ANY_STRING);
    const [adminFilter, setAdminFilter] = useState(initialState.filterbyAdmin ?? SEARCH_ANY_STRING);

    const submitSearch = useCallback((nextQuery = query) => {
        doSearch(
            { value: nextQuery.trim(), type: searchType },
            typeFilter === SEARCH_ANY_STRING ? undefined : typeFilter,
            adminFilter === SEARCH_ANY_STRING ? undefined : adminFilter,
        );
    }, [adminFilter, doSearch, query, searchType, typeFilter]);

    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return;
        }
        debounceRef.current = window.setTimeout(() => submitSearch(), 350);
        return () => window.clearTimeout(debounceRef.current);
    }, [submitSearch]);

    useEventListener('keydown', (event: KeyboardEvent) => {
        if (event.code === 'KeyF' && (event.ctrlKey || event.metaKey)) {
            inputRef.current?.focus();
            event.preventDefault();
        }
    });

    const resetFilters = () => {
        setQuery('');
        setSearchType(availableSearchTypes[0].value);
        setTypeFilter(SEARCH_ANY_STRING);
        setAdminFilter(SEARCH_ANY_STRING);
        inputRef.current?.focus();
    };

    const selectedSearchType = availableSearchTypes.find(type => type.value === searchType) ?? availableSearchTypes[0];
    if (!authData) throw new Error('authData is not available');
    const filteredAdmins = useMemo(
        () => adminStats.filter(admin => admin.name !== authData.name).sort((left, right) => right.actions - left.actions),
        [adminStats, authData.name],
    );
    const selfActionCount = useMemo(
        () => adminStats.find(admin => admin.name === authData.name)?.actions ?? 0,
        [adminStats, authData.name],
    );
    const activeFilterCount = Number(Boolean(query.trim()))
        + Number(typeFilter !== SEARCH_ANY_STRING)
        + Number(adminFilter !== SEARCH_ANY_STRING);

    //Toolbar controls: 44px on phones, 36px with 13px text from 640px.
    const controlClass = 'h-11 text-dense sm:h-9';

    return <section aria-label={t('Search')} className="flex flex-col gap-2">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-[minmax(240px,1fr)_160px_140px_200px_auto]">
            <div className="relative min-w-0 sm:col-span-3 lg:col-span-1">
                <Input
                    ref={inputRef}
                    value={query}
                    className={`${controlClass} sm:pr-16`}
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-label={t(selectedSearchType.label)}
                    placeholder={t(selectedSearchType.placeholder)}
                    onChange={event => setQuery(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter') {
                            window.clearTimeout(debounceRef.current);
                            submitSearch();
                        }
                        if (event.key === 'Escape') setQuery('');
                    }}
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-xs bg-raise-2 px-1.5 font-mono text-micro text-muted-foreground sm:block">ctrl+f</kbd>
            </div>
            <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className={controlClass}><SelectValue /></SelectTrigger>
                <SelectContent>{availableSearchTypes.map(type => <SelectItem key={type.value} value={type.value}>{t(type.label)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className={controlClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={SEARCH_ANY_STRING}>{t('Any type')}</SelectItem>
                    <SelectItem value="ban">{t('Bans')}</SelectItem>
                    <SelectItem value="warn">{t('Warnings')}</SelectItem>
                </SelectContent>
            </Select>
            <Select value={adminFilter} onValueChange={setAdminFilter}>
                <SelectTrigger className={controlClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={SEARCH_ANY_STRING}>{t('Any administrator')}</SelectItem>
                    <SelectItem value={authData.name}>{authData.name} <span className="tabular-nums text-muted-foreground">({selfActionCount})</span></SelectItem>
                    <SelectSeparator />
                    {filteredAdmins.map(admin => <SelectItem key={admin.name} value={admin.name}>{admin.name} <span className="tabular-nums text-muted-foreground">({admin.actions})</span></SelectItem>)}
                </SelectContent>
            </Select>
            {activeFilterCount > 0 && <Button
                variant="secondary"
                size="sm"
                className="sm:col-span-3 sm:justify-self-start lg:col-span-1"
                onClick={resetFilters}
            >
                {t('Clear filters')}
            </Button>}
        </div>
        <p className="text-dense text-muted-foreground">{t(selectedSearchType.description)}</p>
    </section>;
}
