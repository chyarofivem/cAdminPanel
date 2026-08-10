import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    AlertCircle,
    ArrowLeft,
    BadgeDollarSign,
    Car,
    Clock3,
    Database,
    Fingerprint,
    History,
    Loader2,
    LockKeyhole,
    RefreshCw,
    Save,
    ShieldCheck,
    UserRoundCog,
} from 'lucide-react';
import { useLocation, useRoute } from 'wouter';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAdminPerms } from '@/hooks/auth';
import { useOpenActionModal } from '@/hooks/actionModal';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { useAuthedFetcher, useBackendApi } from '@/hooks/fetch';
import { msToDuration, tsToLocaleDateTimeString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { GenericApiOkResp } from '@shared/genericApiTypes';
import type { PlayerHistoryItem, PlayerModalResp, PlayerModalSuccess } from '@shared/playerApiTypes';
import {
    cadminApiPath,
    cadminCharacterIdentifier,
    cadminData,
    toTxAdminLicense,
    type CadminPlayer,
    type CadminResponse,
} from '@/pages/CAdmin/api';
import GarageTab from '@/pages/CAdmin/GarageTab';
import GroupTab from '@/pages/CAdmin/GroupTab';
import InventoryTab from '@/pages/CAdmin/InventoryTab';
import JobTab from '@/pages/CAdmin/JobTab';
import MoneyTab from '@/pages/CAdmin/MoneyTab';
import PlayerActions, { type PlayerActionTarget } from './PlayerActions';

type CharacterLookupState = {
    kind: 'disabled' | 'locked' | 'loading' | 'error' | 'empty' | 'ready';
    message?: string;
};

export default function PlayerDetailPage() {
    const [, params] = useRoute('/administration/players/:license');
    const rawLicense = decodeURIComponent(params?.license ?? '');
    const license = toTxAdminLicense(rawLicense);
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const setLocation = useLocation()[1];
    const [selectedCharacterId, setSelectedCharacterId] = useState(() => (
        new URLSearchParams(window.location.search).get('character') || ''
    ));
    const [retryingCharacter, setRetryingCharacter] = useState(false);

    const txDetails = useSWR<PlayerModalSuccess>(license ? `/player?license=${encodeURIComponent(license)}` : null, async (url: string) => {
        const response = await fetcher<PlayerModalResp>(url);
        if ('error' in response) throw new Error(response.error);
        return response;
    });
    const cadminEnabled = window.txConsts.cadminEnabled;
    const canViewCharacter = hasPerm('cadmin.players.view');
    const canQueryCharacter = cadminEnabled && canViewCharacter;
    const characterListUrl = canQueryCharacter && license
        ? `${cadminApiPath(`player/${encodeURIComponent(license)}`)}?scope=player`
        : null;
    const characterList = useSWR<CadminPlayer[]>(characterListUrl, async (url: string) => (
        cadminData(await fetcher<CadminResponse<CadminPlayer[]>>(url))
    ));
    useEffect(() => {
        const characters = characterList.data;
        if (!characters) return;
        if (characters.some(character => cadminCharacterIdentifier(character) === selectedCharacterId)) return;
        const next = characters.find(character => character.online) ?? characters[0];
        const nextCharacterId = next ? cadminCharacterIdentifier(next) : '';
        setSelectedCharacterId(nextCharacterId);
        const url = new URL(window.location.toString());
        if (nextCharacterId) url.searchParams.set('character', nextCharacterId);
        else url.searchParams.delete('character');
        window.history.replaceState({}, '', url);
    }, [characterList.data, selectedCharacterId]);
    const selectedCharacter = characterList.data?.find(character => (
        cadminCharacterIdentifier(character) === selectedCharacterId
    ));
    const characterUrl = canQueryCharacter && selectedCharacter
        ? cadminApiPath(`player/${encodeURIComponent(selectedCharacterId)}`)
        : null;
    const characterDetails = useSWR<CadminPlayer>(characterUrl, async (url: string) => (
        cadminData(await fetcher<CadminResponse<CadminPlayer>>(url))
    ));

    const selectCharacter = (characterId: string) => {
        setSelectedCharacterId(characterId);
        const url = new URL(window.location.toString());
        url.searchParams.set('character', characterId);
        window.history.replaceState({}, '', url);
    };

    if (!license) return <div className="pb-10">
        <PageHeader title={t('Player Management')} icon={<UserRoundCog className="size-6" />} />
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">{t('This is not a valid FiveM license.')}</div>
    </div>;

    const txPlayer = txDetails.data?.player;
    const loadedCharacter = characterDetails.data;
    const characterLookupState: CharacterLookupState = !cadminEnabled
        ? { kind: 'disabled', message: t('Character Management is disabled.') }
        : !canViewCharacter
        ? { kind: 'locked', message: t('You do not have permission to perform this Character Management action.') }
        : retryingCharacter
            ? { kind: 'loading', message: t('Loading character...') }
            : characterList.error
            ? { kind: 'error', message: characterList.error.message }
            : !characterList.data || characterList.isLoading
                ? { kind: 'loading', message: t('Loading character...') }
                : characterList.data.length === 0
                    ? { kind: 'empty', message: t('No framework character was found for this license.') }
                    : characterDetails.error
                        ? { kind: 'error', message: characterDetails.error.message }
                        : !loadedCharacter || characterDetails.isLoading
                            ? { kind: 'loading', message: t('Loading character...') }
                            : { kind: 'ready' };
    const character = characterLookupState.kind === 'ready' ? loadedCharacter : undefined;
    const initialPlayerLoading = !txPlayer && !character
        && (txDetails.isLoading || characterLookupState.kind === 'loading');
    const displayName = character?.name || txPlayer?.displayName || t('Unknown player');
    const isOnline = Boolean(txPlayer?.isConnected || character?.online);
    const ids = txPlayer ? [...new Set([...txPlayer.idsOnline, ...txPlayer.idsOffline])] : [];
    const target: PlayerActionTarget = {
        license,
        name: displayName,
        isOnline,
        isRegistered: Boolean(txPlayer?.isRegistered),
        ids,
    };
    const refresh = () => {
        void txDetails.mutate();
        void characterList.mutate();
        void characterDetails.mutate();
    };
    const retryCharacter = async () => {
        if (retryingCharacter) return;
        setRetryingCharacter(true);
        try {
            await characterList.mutate();
            await characterDetails.mutate();
        } catch {
            // SWR stores the request error and the state panel renders it.
        } finally {
            setRetryingCharacter(false);
        }
    };

    return <div className="w-full min-w-0 pb-10">
        <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-zinc-400" onClick={() => setLocation('/administration/players')}>
            <ArrowLeft className="mr-2 size-4" />{t('Back to Player Management')}
        </Button>
        <PageHeader title={displayName} icon={<UserRoundCog className="size-6" />} />

        <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.035] p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-md px-2 py-1 text-xs', isOnline ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-zinc-500')}>{isOnline ? t('Online') : t('Offline')}</span>
                    {character && <span className="rounded-md bg-brand-500/10 px-2 py-1 text-xs text-brand-300">{character.group || 'user'}</span>}
                    {txPlayer?.isRegistered && <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-300">{t('txAdmin record')}</span>}
                </div>
                <p className="mt-2 break-all font-mono text-xs text-zinc-600">{selectedCharacterId || `license:${license}`}</p>
            </div>
            <PlayerActions target={target} extended onChanged={refresh} className="flex flex-wrap gap-2" />
        </div>

        {txDetails.error && <div className="mb-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            {t('txAdmin record unavailable: {error}', { error: txDetails.error.message })}
        </div>}

        {characterLookupState.kind !== 'ready' && !initialPlayerLoading && <CharacterManagementState
            state={characterLookupState}
            license={license}
            onRetry={() => void retryCharacter()}
        />}

        {characterList.data && characterList.data.length > 1 && <div className="mb-4 rounded-2xl border border-white/5 bg-white/[0.035] p-4">
            <Label htmlFor="player-management-character">{t('Character')}</Label>
            <select
                id="player-management-character"
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0f1116] px-3 text-sm text-white outline-none focus:border-brand-600 sm:max-w-md"
                value={selectedCharacterId}
                onChange={event => selectCharacter(event.target.value)}
            >
                {characterList.data.map(entry => {
                    const characterId = cadminCharacterIdentifier(entry);
                    return <option key={characterId} value={characterId}>{entry.name || characterId}</option>;
                })}
            </select>
        </div>}

        {initialPlayerLoading
            ? <div className="rounded-2xl bg-white/[0.035] p-12 text-center text-sm text-zinc-500">{t('Loading player management...')}</div>
            : <>
                <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Metric icon={<Clock3 />} label={t('Play time')} value={txPlayer?.playTime ? msToDuration(txPlayer.playTime * 60_000, { units: ['d', 'h', 'm'] }) : '—'} />
                    <Metric icon={<BadgeDollarSign />} label={t('Cash')} value={character ? Number(character.money?.cash || 0).toLocaleString() : '—'} />
                    <Metric icon={<Car />} label={t('Vehicles')} value={character ? String(character.vehicles?.length ?? 0) : '—'} />
                    <Metric icon={<History />} label={t('Sanctions')} value={String(txPlayer?.actionHistory.filter(action => !action.revokedAt).length ?? 0)} />
                </div>

                <Tabs key={`${cadminEnabled}:${canViewCharacter}`} defaultValue="overview" className="rounded-2xl border border-white/5 bg-white/[0.025] p-4 md:p-6">
                    <TabsList className="h-auto w-full flex-wrap justify-start bg-white/5">
                        <TabsTrigger value="overview">{t('Overview')}</TabsTrigger>
                        {cadminEnabled && <TabsTrigger value="money">{t('Money')}</TabsTrigger>}
                        {cadminEnabled && <TabsTrigger value="job">{t('Job')}</TabsTrigger>}
                        {cadminEnabled && <TabsTrigger value="group">{t('Group')}</TabsTrigger>}
                        {cadminEnabled && <TabsTrigger value="inventory">{t('Inventory')}</TabsTrigger>}
                        {cadminEnabled && <TabsTrigger value="garage">{t('Garage')}</TabsTrigger>}
                        {txPlayer && <TabsTrigger value="history">{t('History')}</TabsTrigger>}
                        {txPlayer && <TabsTrigger value="identifiers">{t('Identifiers')}</TabsTrigger>}
                    </TabsList>

                    <TabsContent value="overview" className="mt-6">
                        <OverviewTab player={txDetails.data} character={character} license={license} refresh={refresh} />
                    </TabsContent>
                    {cadminEnabled && <TabsContent value="money" className="mt-6">{character
                        ? <MoneyTab player={character} refresh={refresh} />
                        : <CharacterManagementState state={characterLookupState} license={license} onRetry={() => void retryCharacter()} />}
                    </TabsContent>}
                    {cadminEnabled && <TabsContent value="job" className="mt-6">{character
                        ? <JobTab player={character} refresh={refresh} />
                        : <CharacterManagementState state={characterLookupState} license={license} onRetry={() => void retryCharacter()} />}
                    </TabsContent>}
                    {cadminEnabled && <TabsContent value="group" className="mt-6">{character
                        ? <GroupTab player={character} refresh={refresh} />
                        : <CharacterManagementState state={characterLookupState} license={license} onRetry={() => void retryCharacter()} />}
                    </TabsContent>}
                    {cadminEnabled && <TabsContent value="inventory" className="mt-6">{character
                        ? <InventoryTab player={character} refresh={refresh} />
                        : <CharacterManagementState state={characterLookupState} license={license} onRetry={() => void retryCharacter()} />}
                    </TabsContent>}
                    {cadminEnabled && <TabsContent value="garage" className="mt-6">{character
                        ? <GarageTab player={character} refresh={refresh} />
                        : <CharacterManagementState state={characterLookupState} license={license} onRetry={() => void retryCharacter()} />}
                    </TabsContent>}
                    {txPlayer && <TabsContent value="history" className="mt-6"><HistoryTab actions={txPlayer.actionHistory} serverTime={txDetails.data!.serverTime} /></TabsContent>}
                    {txPlayer && <TabsContent value="identifiers" className="mt-6"><IdentifiersTab license={license} player={txPlayer} refresh={refresh} /></TabsContent>}
                </Tabs>
            </>}
    </div>;
}

function CharacterManagementState({
    state,
    license,
    onRetry,
}: {
    state: CharacterLookupState;
    license: string;
    onRetry: () => void;
}) {
    const isError = state.kind === 'error';
    const isLocked = state.kind === 'locked';
    const isLoading = state.kind === 'loading';
    const Icon = isLoading ? Loader2 : isLocked ? LockKeyhole : isError ? AlertCircle : UserRoundCog;
    return <section className={cn(
        'mb-4 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between',
        isError
            ? 'border-red-500/20 bg-red-500/[0.08]'
            : isLocked
                ? 'border-amber-500/20 bg-amber-500/[0.08]'
                : 'border-white/5 bg-white/[0.035]',
    )}>
        <div className="flex min-w-0 gap-3">
            <Icon className={cn(
                'mt-0.5 size-5 shrink-0',
                isLoading && 'animate-spin text-zinc-500',
                isError && 'text-red-300',
                isLocked && 'text-amber-300',
                state.kind === 'empty' && 'text-brand-400',
            )} />
            <div className="min-w-0">
                <h3 className="font-medium text-white">{t('Character Management')}</h3>
                <p className={cn('mt-1 text-sm', isError ? 'text-red-200' : isLocked ? 'text-amber-200' : 'text-zinc-400')}>{state.message}</p>
                <p className="mt-2 break-all font-mono text-[11px] text-zinc-600">license:{license}</p>
            </div>
        </div>
        {(isError || state.kind === 'empty') && <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 size-3.5" />{t('Try again')}
        </Button>}
    </section>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return <div className="rounded-2xl border border-white/5 bg-white/[0.035] p-4">
        <div className="flex items-center justify-between text-zinc-500"><span className="text-xs uppercase tracking-widest">{label}</span><span className="[&_svg]:size-4">{icon}</span></div>
        <p className="mt-2 truncate text-lg font-semibold text-white">{value}</p>
    </div>;
}

function OverviewTab({
    player,
    character,
    license,
    refresh,
}: {
    player?: PlayerModalSuccess;
    character?: CadminPlayer;
    license: string;
    refresh: () => void;
}) {
    const { hasPerm } = useAdminPerms();
    const txPlayer = player?.player;
    const [notes, setNotes] = useState(txPlayer?.notes ?? '');
    const [saving, setSaving] = useState(false);
    useEffect(() => setNotes(txPlayer?.notes ?? ''), [txPlayer?.notes]);
    const noteApi = useBackendApi<GenericApiOkResp>({ method: 'POST', path: '/player/save_note', throwGenericErrors: true });
    const allowlistApi = useBackendApi<GenericApiOkResp>({ method: 'POST', path: '/player/whitelist', throwGenericErrors: true });

    const saveNote = () => {
        setSaving(true);
        void noteApi({
            queryParams: { license },
            data: { note: notes.trim() },
            toastLoadingMessage: t('Saving note...'),
            genericHandler: { successMsg: t('Player note saved.') },
            success: refresh,
            finally: () => setSaving(false),
        });
    };
    const toggleAllowlist = () => {
        if (!txPlayer) return;
        void allowlistApi({
            queryParams: { license },
            data: { status: !txPlayer.tsWhitelisted },
            toastLoadingMessage: t('Updating allowlist...'),
            genericHandler: { successMsg: t('Allowlist updated.') },
            success: refresh,
        });
    };

    return <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
            <Card className="border-white/5 bg-white/[0.03] shadow-none">
                <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
                    <Detail label={t('Connection')} value={txPlayer?.isConnected ? t('Connected') : t('Offline')} />
                    <Detail label={t('First joined')} value={txPlayer?.tsJoined ? tsToLocaleDateTimeString(txPlayer.tsJoined, 'medium', 'short') : '—'} />
                    <Detail label={t('Last connection')} value={txPlayer?.tsLastConnection ? tsToLocaleDateTimeString(txPlayer.tsLastConnection, 'medium', 'short') : '—'} />
                    <Detail label={t('Allowlist')} value={txPlayer?.tsWhitelisted ? t('Allowed') : t('Not allowed')} />
                    {character && <Detail label={t('Job')} value={`${character.job?.label || character.job?.name || t('None')} · ${t('Grade {grade}', { grade: character.job?.grade ?? 0 })}`} />}
                    {character && <Detail label={t('Framework group')} value={character.group || 'user'} />}
                </CardContent>
            </Card>
            {txPlayer && <Card className="border-white/5 bg-white/[0.03] shadow-none">
                <CardContent className="p-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <Label htmlFor="player-management-notes">{t('Staff notes')}</Label>
                        <Button size="sm" variant="outline" disabled={saving || !txPlayer.isRegistered} onClick={saveNote}><Save className="mr-1.5 size-4" />{t('Save note')}</Button>
                    </div>
                    <Textarea id="player-management-notes" value={notes} disabled={!txPlayer.isRegistered} onChange={event => setNotes(event.target.value)} placeholder={t('Write an internal note about this player.')} />
                    <p className="mt-2 text-xs text-zinc-600">{txPlayer.notesLog || t('Only panel staff can see these notes.')}</p>
                </CardContent>
            </Card>}
        </div>
        <div className="space-y-4">
            <Card className="border-white/5 bg-white/[0.03] shadow-none">
                <CardContent className="p-5">
                    <h3 className="flex items-center font-medium text-white"><ShieldCheck className="mr-2 size-4 text-brand-400" />{t('Access')}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{txPlayer?.tsWhitelisted ? t('This license is allowlisted.') : t('This license is not allowlisted.')}</p>
                    <Button className="mt-4 w-full" variant="outline" disabled={!txPlayer || !hasPerm('players.whitelist')} onClick={toggleAllowlist}>
                        {txPlayer?.tsWhitelisted ? t('Remove from allowlist') : t('Add to allowlist')}
                    </Button>
                </CardContent>
            </Card>
            <Card className="border-white/5 bg-white/[0.03] shadow-none">
                <CardContent className="p-5">
                    <h3 className="flex items-center font-medium text-white"><Database className="mr-2 size-4 text-brand-400" />{t('chyarologin identity')}</h3>
                    {character?.account ? <>
                        <p className="mt-3 break-all text-sm text-zinc-200">{character.account.email}</p>
                        <p className="mt-1 text-xs text-zinc-500">{character.account.discordUsername || character.account.discordId || t('Discord not linked')}</p>
                    </> : <p className="mt-3 text-sm text-zinc-500">{t('No linked chyarologin identity.')}</p>}
                </CardContent>
            </Card>
        </div>
    </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
    return <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-xs uppercase tracking-widest text-zinc-600">{label}</p><p className="mt-1 text-sm text-zinc-200">{value}</p></div>;
}

function HistoryTab({ actions, serverTime }: { actions: PlayerHistoryItem[]; serverTime: number }) {
    const openAction = useOpenActionModal();
    if (!actions.length) return <p className="py-10 text-center text-sm text-zinc-500">{t('No bans or warnings recorded.')}</p>;
    return <div className="space-y-2">{[...actions].reverse().map(action => {
        const active = !action.revokedAt && (!action.exp || action.exp > serverTime);
        return <button
            type="button"
            key={action.id}
            className="flex w-full flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.025] p-4 text-left transition hover:bg-white/5 md:flex-row md:items-center md:justify-between"
            onClick={() => openAction(action.id)}
        >
            <span>
                <span className={cn('text-xs font-semibold uppercase tracking-widest', action.type === 'ban' ? 'text-red-300' : 'text-amber-300')}>{t(action.type === 'ban' ? 'Ban' : 'Warning')}</span>
                <span className="ml-2 text-xs text-zinc-600">{action.id}</span>
                <span className="mt-1 block text-sm text-zinc-200">{action.reason}</span>
            </span>
            <span className="shrink-0 text-xs text-zinc-500">
                {action.author} · {tsToLocaleDateTimeString(action.ts, 'medium', 'short')} · {active ? t('Active') : t('Inactive')}
            </span>
        </button>;
    })}</div>;
}

function IdentifiersTab({ license, player, refresh }: { license: string; player: PlayerModalSuccess['player']; refresh: () => void }) {
    const { hasPerm } = useAdminPerms();
    const openConfirm = useOpenConfirmDialog();
    const removeApi = useBackendApi<GenericApiOkResp>({ method: 'POST', path: '/player/removeIds', throwGenericErrors: true });
    const online = new Set([...player.idsOnline, ...player.hwidsOnline]);
    const identifiers = useMemo(() => [...new Set([
        ...player.idsOnline,
        ...player.idsOffline,
        ...player.hwidsOnline,
        ...player.hwidsOffline,
    ])], [player]);

    const remove = (identifier: string) => openConfirm({
        title: t('Remove identifier?'),
        message: <span className="break-all font-mono text-xs">{identifier}</span>,
        actionLabel: t('Remove identifier'),
        onConfirm: () => {
            void removeApi({
                queryParams: { license },
                data: { ids: [identifier] },
                toastLoadingMessage: t('Removing identifier...'),
                genericHandler: { successMsg: t('Identifier removed.') },
                success: refresh,
            });
        },
    });

    return <div className="space-y-2">
        <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400"><Fingerprint className="size-4" />{t('Online identifiers are protected until the player disconnects.')}</div>
        {identifiers.map(identifier => {
            const isOnline = online.has(identifier);
            const protectedLicense = identifier.startsWith('license:') || identifier.startsWith('license2:');
            return <div key={identifier} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.025] px-4 py-3">
                <div className="min-w-0"><p className="break-all font-mono text-xs text-zinc-300">{identifier}</p><p className="mt-1 text-[11px] text-zinc-600">{isOnline ? t('Active this session') : t('Saved history')}</p></div>
                <Button size="sm" variant="destructive" disabled={!hasPerm('players.remove_ids') || isOnline || protectedLicense} onClick={() => remove(identifier)}>{t('Remove')}</Button>
            </div>;
        })}
        {!identifiers.length && <p className="py-10 text-center text-sm text-zinc-500">{t('No identifiers recorded.')}</p>}
    </div>;
}
