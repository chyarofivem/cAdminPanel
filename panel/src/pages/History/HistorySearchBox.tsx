import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, ExternalLinkIcon, Search, SlidersHorizontal, XIcon } from 'lucide-react';
import { Link } from 'wouter';
import { useEventListener } from 'usehooks-ts';
import type { HistoryTableSearchType } from '@shared/historyApiTypes';
import InlineCode from '@/components/InlineCode';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

    return <section className="mb-4 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.035] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-white/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                <SlidersHorizontal className="size-4 text-brand-500" />
                {t('Find activity')}
                {activeFilterCount > 0 && <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs text-brand-400">{activeFilterCount}</span>}
            </div>
            {activeFilterCount > 0 && <Button variant="ghost-muted" size="sm" onClick={resetFilters}>
                <XIcon className="mr-1.5 size-3.5" />{t('Clear filters')}
            </Button>}
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(240px,1fr)_180px_150px_180px_auto]">
            <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-500" />
                <Input
                    ref={inputRef}
                    value={query}
                    className="pl-9 pr-14"
                    autoCapitalize="off"
                    autoCorrect="off"
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
                <InlineCode className="pointer-events-none absolute right-2.5 top-2.5 text-[10px] tracking-wide text-zinc-500">ctrl+f</InlineCode>
            </div>
            <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{availableSearchTypes.map(type => <SelectItem key={type.value} value={type.value}>{t(type.label)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={SEARCH_ANY_STRING}>{t('Any type')}</SelectItem>
                    <SelectItem value="ban">{t('Bans')}</SelectItem>
                    <SelectItem value="warn">{t('Warnings')}</SelectItem>
                </SelectContent>
            </Select>
            <Select value={adminFilter} onValueChange={setAdminFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={SEARCH_ANY_STRING}>{t('Any administrator')}</SelectItem>
                    <SelectItem value={authData.name}>{authData.name} <span className="opacity-50">({selfActionCount})</span></SelectItem>
                    <SelectSeparator />
                    {filteredAdmins.map(admin => <SelectItem key={admin.name} value={admin.name}>{admin.name} <span className="opacity-50">({admin.actions})</span></SelectItem>)}
                </SelectContent>
            </Select>
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline">{t('More')}<ChevronDownIcon className="ml-2 size-4 opacity-50" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href="/system/master-actions#cleandb" className="cursor-pointer"><ExternalLinkIcon className="mr-2 size-4" />{t('Bulk Remove')}</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/settings/ban-templates" className="cursor-pointer"><ExternalLinkIcon className="mr-2 size-4" />{t('Ban Templates')}</Link></DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <p className="px-5 pb-4 text-xs text-zinc-500">{t(selectedSearchType.description)}</p>
    </section>;
}
