import { useMemo, useState } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { AlertTriangle, Car, Database, Search, ShieldCheck, UserRoundCog, UsersRound } from 'lucide-react';
import { useLocation } from 'wouter';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    type CadminPlayer,
    type CadminResponse,
} from '@/pages/CAdmin/api';
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

    const canViewCharacters = window.txConsts.cadminEnabled && hasPerm('cadmin.players.view');
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

    return <div className="flex w-full min-w-0 flex-col pb-10">
        <PageHeader title={t('Player Management')} icon={<UserRoundCog className="size-6" />} />
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric icon={<UsersRound />} label={t('Players shown')} value={managedPlayers.length} />
            <Metric icon={<Database />} label={t('Framework characters')} value={frameworkCharacters} />
            <Metric icon={<Car />} label={t('Vehicles shown')} value={managedPlayers.reduce((total, player) => total + player.characters.reduce((count, character) => count + (character.vehicles?.length ?? 0), 0), 0)} />
            <Metric icon={<ShieldCheck />} label={t('Staff shown')} value={managedPlayers.filter(player => player.isAdmin).length} />
        </div>

        <Card className="mb-4 border-white/5 bg-white/[0.035] shadow-none">
            <CardContent className="p-4">
                <form className="flex flex-col gap-3 lg:flex-row" onSubmit={submit}>
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-500" />
                        <Input
                            className="pl-9"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder={t('Search players...')}
                        />
                    </div>
                    <select
                        className="h-10 rounded-lg border border-white/10 bg-[#0f1116] px-3 text-sm text-white outline-none focus:border-brand-600"
                        value={mode}
                        onChange={event => setMode(event.target.value as SearchMode)}
                        aria-label={t('Search field')}
                    >
                        {(Object.keys(searchModeLabels) as SearchMode[]).map(key => <option key={key} value={key}>{t(searchModeLabels[key])}</option>)}
                    </select>
                    <Button type="submit">{t('Search')}</Button>
                    {submitted && <Button type="button" variant="outline" onClick={clearSearch}>{t('Clear')}</Button>}
                </form>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant={onlineOnly ? 'secondary' : 'ghost'} onClick={() => setOnlineOnly(value => !value)}>{t('Online only')}</Button>
                    <Button size="sm" variant={staffOnly ? 'secondary' : 'ghost'} onClick={() => setStaffOnly(value => !value)}>{t('Staff only')}</Button>
                    <span className="self-center text-xs text-zinc-500">{t('txAdmin records and framework characters are matched by FiveM license.')}</span>
                </div>
            </CardContent>
        </Card>

        {(txSearch.error || characterSearch.error) && <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {txSearch.error ? t('txAdmin player search failed: {error}', { error: txSearch.error.message }) : null}
            {txSearch.error && characterSearch.error ? <br /> : null}
            {characterSearch.error ? t('Character search failed: {error}', { error: characterSearch.error.message }) : null}
        </div>}

        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.025]">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-sm">
                    <thead className="border-b border-dashed border-white/5 text-xs uppercase tracking-widest text-zinc-500">
                        <tr>
                            <th className="px-5 py-3 text-left font-medium">{t('Player')}</th>
                            <th className="px-5 py-3 text-left font-medium">{t('Character')}</th>
                            <th className="px-5 py-3 text-left font-medium">{t('Status')}</th>
                            <th className="px-5 py-3 text-left font-medium">{t('Activity')}</th>
                            <th className="px-5 py-3 text-right font-medium">{t('Quick actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-white/5">
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
                            return <tr
                                key={player.identityKey}
                                className={cn(
                                    'transition',
                                    player.identityError ? 'cursor-default bg-amber-500/[0.025]' : 'cursor-pointer hover:bg-white/[0.04]',
                                )}
                                onClick={() => {
                                    if (!player.identityError) setLocation(detailUrl);
                                }}
                            >
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className={cn('size-2.5 rounded-full', player.isOnline ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.6)]' : 'bg-zinc-700')} />
                                        <div className="min-w-0">
                                            <p className="max-w-64 truncate font-medium text-white">{player.displayName}</p>
                                            <p className="max-w-64 truncate font-mono text-[11px] text-zinc-600">license:{player.license}</p>
                                            {player.identityError && <p className="mt-1 flex max-w-64 items-center gap-1 text-xs text-amber-300">
                                                <AlertTriangle className="size-3" />{player.identityError}
                                            </p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    {character ? <>
                                        <p className="font-medium text-zinc-200">{character.name || t('Unnamed character')}</p>
                                        <p className="mt-0.5 text-xs text-zinc-500">
                                            {character.job?.label || character.job?.name || t('No job')}
                                            {player.characters.length > 1 ? ` · ${t('{count} characters', { count: player.characters.length })}` : ''}
                                        </p>
                                    </> : <span className="text-zinc-600">{canViewCharacters && characterSearch.isLoading
                                        ? t('Loading character...')
                                        : t('No framework character')}</span>}
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className={cn('rounded-md px-2 py-1 text-xs', player.isOnline ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-zinc-500')}>{player.isOnline ? t('Online') : t('Offline')}</span>
                                        {player.isAdmin && <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-300">{t('Staff')}</span>}
                                        {character && <span className="rounded-md bg-brand-500/10 px-2 py-1 text-xs text-brand-300">{character.group || 'user'}</span>}
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-xs text-zinc-400">
                                    {character ? <>
                                        <p>{t('Cash')}: <span className="font-mono text-zinc-300">{money(character.money?.cash)}</span></p>
                                        <p className="mt-0.5">{t('Vehicles')}: <span className="font-mono text-zinc-300">{character.vehicles?.length ?? 0}</span></p>
                                    </> : player.txAdmin ? <p>{t('Play time')}: <span className="font-mono text-zinc-300">{player.txAdmin.playTime.toLocaleString()} min</span></p> : '—'}
                                </td>
                                <td className="px-5 py-4">
                                    {player.identityError
                                        ? <span className="text-xs text-amber-300">{t('Resolve identifiers first')}</span>
                                        : <PlayerActions target={target} onChanged={refresh} className="flex justify-end gap-2" />}
                                </td>
                            </tr>;
                        })}
                    </tbody>
                </table>
            </div>
            {!managedPlayers.length && !txSearch.isLoading && <p className="px-6 py-14 text-center text-sm text-zinc-500">{t('No players matched this view.')}</p>}
            {(txSearch.isLoading || characterSearch.isLoading) && !managedPlayers.length && <p className="px-6 py-14 text-center text-sm text-zinc-500">{t('Loading players...')}</p>}
        </div>

        {!reachedEnd && txSearch.data?.length ? <Button
            className="mx-auto mt-4"
            variant="outline"
            disabled={txSearch.isValidating}
            onClick={() => void txSearch.setSize(size => size + 1)}
        >{txSearch.isValidating ? t('Loading...') : t('Load more')}</Button> : null}
    </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
    return <div className="rounded-2xl border border-white/5 bg-white/[0.035] p-4">
        <div className="flex items-center justify-between text-zinc-500"><span className="text-xs uppercase tracking-widest">{label}</span><span className="[&_svg]:size-4">{icon}</span></div>
        <p className="mt-2 text-2xl font-semibold text-white">{value.toLocaleString()}</p>
    </div>;
}
