import { useMemo, useState } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { Link, useLocation } from 'wouter';
import EmptyState from '@/components/EmptyState';
import { ListRow, ListRows } from '@/components/ListRow';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminPerms } from '@/hooks/auth';
import { useAuthedFetcher } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { PlayersTablePlayerType, PlayersTableSearchResp } from '@shared/playerApiTypes';
import {
    cadminApiPath,
    cadminCharacterIdentifier,
    cadminData,
    isCadminAvailable,
    type CadminPlayer,
    type CadminResponse,
} from '@/pages/CAdmin/api';
import { nativeSelectClass } from '@/pages/CAdmin/nativeSelect';
import PlayerActions, { type PlayerActionTarget } from './PlayerActions';
import { buildPlayerLicenseAliasIndex, resolveFrameworkPlayerLicense } from './playerIdentity';

type TxSearchSuccess = Exclude<PlayersTableSearchResp, { error: string }>;
type SearchMode = 'playerName' | 'playerIds' | 'playerNotes';

type ManagedPlayer = {
    identityKey: string;
    license: string;
    txAdmin?: PlayersTablePlayerType;
    characters: CadminPlayer[];
    displayName: string;
    isOnline: boolean;
    isAdmin: boolean;
    identityError?: string;
};

const searchModeLabels: Record<SearchMode, string> = {
    playerName: 'Name',
    playerIds: 'Identifier',
    playerNotes: 'Notes',
};

const money = (value?: number) => Number(value || 0).toLocaleString();

function buildTxSearchUrl(
    query: string,
    mode: SearchMode,
    filters: string[],
    previous?: TxSearchSuccess,
) {
    const params = new URLSearchParams({ sortingKey: 'tsLastConnection', sortingDesc: 'true' });
    if (query) {
        params.set('searchValue', query);
        params.set('searchType', mode);
    }
    if (filters.length) params.set('filters', filters.join(','));
    const last = previous?.players.at(-1);
    if (last) {
        params.set('offsetParam', String(last.tsLastConnection));
        params.set('offsetLicense', last.license);
    }
    return `/player/search?${params.toString()}`;
}

export default function PlayerManagementPage() {
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const setLocation = useLocation()[1];
    const initialParams = new URLSearchParams(window.location.search);
    const initialQuery = initialParams.get('q') ?? '';
    const initialModeParam = initialParams.get('mode');
    const initialMode: SearchMode = initialModeParam && initialModeParam in searchModeLabels
        ? initialModeParam as SearchMode
        : 'playerName';
    const [search, setSearch] = useState(initialQuery);
    const [submitted, setSubmitted] = useState(initialQuery.trim());
    const [mode, setMode] = useState<SearchMode>(initialMode);
    const [onlineOnly, setOnlineOnly] = useState(false);
    const [staffOnly, setStaffOnly] = useState(false);
    const txFilters = useMemo(() => [
        ...(onlineOnly ? ['isOnline'] : []),
        ...(staffOnly ? ['isAdmin'] : []),
    ], [onlineOnly, staffOnly]);

    const txSearch = useSWRInfinite<TxSearchSuccess>(
        (page, previous: TxSearchSuccess | null) => {
            if (previous?.hasReachedEnd) return null;
            return buildTxSearchUrl(submitted, mode, txFilters, page ? previous ?? undefined : undefined);
        },
        async url => {
            const response = await fetcher<PlayersTableSearchResp>(url);
            if ('error' in response) throw new Error(response.error);
            return response;
        },
        { refreshInterval: 10_000, revalidateFirstPage: true },
    );

    const canViewCharacters = isCadminAvailable() && hasPerm('cadmin.players.view');
    const canSearchCharacters = hasPerm('cadmin.players.search_offline');
    const shouldMergeCharacters = canViewCharacters && (!submitted || mode !== 'playerNotes');
    const characterUrl = shouldMergeCharacters
        ? submitted.length >= 2 && canSearchCharacters
            ? `${cadminApiPath('players')}?q=${encodeURIComponent(submitted)}`
            : cadminApiPath('players')
        : null;
    const characterSearch = useSWR(characterUrl, async url => (
        cadminData(await fetcher<CadminResponse<CadminPlayer[]>>(url))
    ), { refreshInterval: submitted ? 0 : 10_000 });

    const txPlayers = useMemo(() => txSearch.data?.flatMap(page => page.players) ?? [], [txSearch.data]);
    const managedPlayers = useMemo(() => {
        const byLicense = new Map<string, ManagedPlayer>();
        const licenseAliases = buildPlayerLicenseAliasIndex(txPlayers);
        for (const player of txPlayers) {
            byLicense.set(player.license, {
                identityKey: player.license,
                license: player.license,
                txAdmin: player,
                characters: [],
                displayName: player.displayName,
                isOnline: player.isOnline,
                isAdmin: player.isAdmin,
            });
        }
        const characterMatchesMode = (character: CadminPlayer) => {
            if (!submitted) return true;
            const needle = submitted.toLocaleLowerCase();
            if (mode === 'playerName') {
                return Boolean(character.name?.toLocaleLowerCase().includes(needle));
            }
            if (mode === 'playerIds') {
                return [character.characterId, character.citizenid, character.identifier, character.playerLicense]
                    .some(value => value?.toLocaleLowerCase().includes(needle));
            }
            return false;
        };
        for (const character of (characterSearch.data ?? []).filter(characterMatchesMode)) {
            const resolvedIdentity = resolveFrameworkPlayerLicense(
                character.playerLicense ?? character.identifier,
                licenseAliases,
            );
            const license = resolvedIdentity.license;
            if (!license) continue;
            const identityKey = resolvedIdentity.ambiguous
                ? `ambiguous:${license}:${cadminCharacterIdentifier(character)}`
                : license;
            const current = byLicense.get(identityKey) ?? {
                identityKey,
                license,
                characters: [],
                displayName: character.name || t('Unnamed character'),
                isOnline: false,
                isAdmin: false,
                identityError: resolvedIdentity.ambiguous
                    ? t('This framework identifier matches multiple player records.')
                    : undefined,
            };
            current.characters.push(character);
            current.isOnline ||= Boolean(character.online);
            if (!current.txAdmin && character.name) current.displayName = character.name;
            byLicense.set(identityKey, current);
        }

        return [...byLicense.values()]
            .filter(player => !onlineOnly || player.isOnline)
            .filter(player => !staffOnly || player.isAdmin)
            .sort((left, right) => {
                if (left.isOnline !== right.isOnline) return left.isOnline ? -1 : 1;
                return (right.txAdmin?.tsLastConnection ?? 0) - (left.txAdmin?.tsLastConnection ?? 0);
            });
    }, [txPlayers, characterSearch.data, onlineOnly, staffOnly, submitted, mode]);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const query = search.trim();
        setSubmitted(query);
        const url = new URL(window.location.toString());
        if (query) url.searchParams.set('q', query);
        else url.searchParams.delete('q');
        if (query) url.searchParams.set('mode', mode);
        else url.searchParams.delete('mode');
        window.history.replaceState({}, '', url);
    };

    const clearSearch = () => {
        setSearch('');
        setSubmitted('');
        const url = new URL(window.location.toString());
        url.searchParams.delete('q');
        url.searchParams.delete('mode');
        window.history.replaceState({}, '', url);
    };

    const refresh = () => {
        void txSearch.mutate();
        void characterSearch.mutate();
    };
    const reachedEnd = txSearch.data?.at(-1)?.hasReachedEnd ?? false;
    const frameworkCharacters = managedPlayers.reduce((total, player) => total + player.characters.length, 0);
    const vehiclesShown = managedPlayers.reduce((total, player) => total + player.characters.reduce((count, character) => count + (character.vehicles?.length ?? 0), 0), 0);
    const staffShown = managedPlayers.filter(player => player.isAdmin).length;
    const isLoadingPlayers = (txSearch.isLoading || characterSearch.isLoading) && !managedPlayers.length;

    return <div className="flex w-full min-w-0 flex-col pb-10">
        <PageHeader title={t('Player Management')} />
        <div className="flex flex-col gap-6">
            <dl className={cn('grid grid-cols-2 gap-4 rounded-lg bg-raise p-4 sm:p-6', canViewCharacters ? 'lg:grid-cols-4' : 'lg:grid-cols-2')}>
                <Metric label={t('Players shown')} value={managedPlayers.length} />
                {canViewCharacters && <Metric label={t('Framework characters')} value={frameworkCharacters} />}
                {canViewCharacters && <Metric label={t('Vehicles shown')} value={vehiclesShown} />}
                <Metric label={t('Staff shown')} value={staffShown} />
            </dl>

            <div className="flex flex-col gap-3">
                <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={submit}>
                    <Input
                        className="min-w-0 flex-1 sm:h-9 sm:text-dense"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder={t('Search players...')}
                        aria-label={t('Search players...')}
                    />
                    <select
                        className={cn(nativeSelectClass, 'sm:h-9 sm:w-auto sm:text-dense')}
                        value={mode}
                        onChange={event => setMode(event.target.value as SearchMode)}
                        aria-label={t('Search field')}
                    >
                        {(Object.keys(searchModeLabels) as SearchMode[]).map(key => <option key={key} value={key}>{t(searchModeLabels[key])}</option>)}
                    </select>
                    <div className="flex gap-2">
                        <Button type="submit" size="sm">{t('Search')}</Button>
                        {submitted && <Button type="button" size="sm" variant="secondary" onClick={clearSearch}>{t('Clear')}</Button>}
                    </div>
                </form>
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={onlineOnly ? 'secondary' : 'ghost'} aria-pressed={onlineOnly} onClick={() => setOnlineOnly(value => !value)}>{t('Online only')}</Button>
                    <Button size="sm" variant={staffOnly ? 'secondary' : 'ghost'} aria-pressed={staffOnly} onClick={() => setStaffOnly(value => !value)}>{t('Staff only')}</Button>
                    {canViewCharacters && <span className="text-dense text-muted-foreground">{t('Panel records and framework characters are matched by FiveM license.')}</span>}
                </div>
            </div>

            {(txSearch.error || characterSearch.error) && <Alert variant="destructive">
                {txSearch.error ? <p>{t('Panel player search failed: {error}', { error: txSearch.error.message })}</p> : null}
                {characterSearch.error ? <p>{t('Character search failed: {error}', { error: characterSearch.error.message })}</p> : null}
            </Alert>}

            <section className="flex min-w-0 flex-col gap-3" aria-labelledby="player-management-list">
                <h2 id="player-management-list" className="text-base font-semibold text-white">{t('Players')}</h2>
                {isLoadingPlayers
                    ? <p role="status" className="rounded-lg bg-raise p-4 text-sm text-muted-foreground sm:p-6">{t('Loading players...')}</p>
                    : !managedPlayers.length && !txSearch.isLoading
                        ? <EmptyState message={t('No players matched this view.')} />
                        : null}

                {managedPlayers.length > 0 && <ListRows>
                    {managedPlayers.map(player => {
                        const character = player.characters.find(item => item.online) ?? player.characters[0];
                        const detailUrl = `/administration/players/${encodeURIComponent(player.license)}`
                            + (character ? `?character=${encodeURIComponent(cadminCharacterIdentifier(character))}` : '');
                        const target: PlayerActionTarget = {
                            license: player.license,
                            name: player.displayName,
                            isOnline: player.isOnline,
                            isRegistered: Boolean(player.txAdmin),
                        };
                        const canOpen = !player.identityError;
                        return <ListRow
                            key={player.identityKey}
                            interactive={canOpen}
                            className={cn('flex-col items-stretch lg:flex-row lg:items-center', canOpen && 'cursor-pointer')}
                            onClick={event => {
                                //The name link navigates on its own, including modifier clicks.
                                if ((event.target as HTMLElement).closest('a')) return;
                                if (canOpen) setLocation(detailUrl);
                            }}
                        >
                            <div className="min-w-0 lg:flex-1">
                                {canOpen
                                    ? <Link href={detailUrl} className="block truncate font-medium text-white transition-colors duration-150 hover:text-accent-glow">{player.displayName}</Link>
                                    : <p className="truncate font-medium text-white">{player.displayName}</p>}
                                <p className="truncate font-mono text-xs text-muted-foreground">license:{player.license}</p>
                                {player.identityError && <p className="mt-1 text-dense text-warning-text">{player.identityError}</p>}
                            </div>
                            {canViewCharacters && <div className="min-w-0 lg:w-56">
                                {character ? <>
                                    <p className="truncate text-sm text-body">{character.name || t('Unnamed character')}</p>
                                    <p className="truncate text-dense text-muted-foreground">
                                        {character.job?.label || character.job?.name || t('No job')}
                                        {player.characters.length > 1 ? ` · ${t('{count} characters', { count: player.characters.length })}` : ''}
                                    </p>
                                </> : <p className="text-dense text-muted-foreground">{characterSearch.isLoading
                                    ? t('Loading character...')
                                    : t('No framework character')}</p>}
                            </div>}
                            <div className="flex flex-wrap gap-1.5 lg:w-44">
                                <Badge variant={player.isOnline ? 'success' : 'default'}>{player.isOnline ? t('Online') : t('Offline')}</Badge>
                                {player.isAdmin && <Badge variant="info">{t('Staff')}</Badge>}
                                {character && <Badge className="font-mono">{character.group || 'user'}</Badge>}
                            </div>
                            <div className="text-dense text-muted-foreground lg:w-36">
                                {character ? <>
                                    <p>{t('Cash')}: <span className="font-mono tabular-nums text-body">{money(character.money?.cash)}</span></p>
                                    <p>{t('Vehicles')}: <span className="font-mono tabular-nums text-body">{character.vehicles?.length ?? 0}</span></p>
                                </> : player.txAdmin
                                    ? <p>{t('Play time')}: <span className="font-mono tabular-nums text-body">{player.txAdmin.playTime.toLocaleString()} min</span></p>
                                    : <p aria-hidden="true">—</p>}
                            </div>
                            <div className="lg:shrink-0">
                                {player.identityError
                                    ? <p className="text-dense text-warning-text">{t('Resolve identifiers first')}</p>
                                    : <PlayerActions target={target} onChanged={refresh} className="flex flex-wrap gap-2 lg:justify-end" />}
                            </div>
                        </ListRow>;
                    })}
                </ListRows>}

                {!reachedEnd && txSearch.data?.length ? <Button
                    className="self-center"
                    variant="secondary"
                    disabled={txSearch.isValidating}
                    onClick={() => void txSearch.setSize(size => size + 1)}
                >{txSearch.isValidating ? t('Loading...') : t('Load more')}</Button> : null}
            </section>
        </div>
    </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
    return <div className="min-w-0">
        <dt className="text-dense text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{value.toLocaleString()}</dd>
    </div>;
}
