import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { CopyIcon, Trash2Icon } from 'lucide-react';
import { useRoute } from 'wouter';
import CopyRow from '@/components/CopyRow';
import EmptyState from '@/components/EmptyState';
import { ListRow, ListRows } from '@/components/ListRow';
import { PageHeader } from '@/components/page-header';
import Section from '@/components/Section';
import { txToast } from '@/components/TxToaster';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAdminPerms } from '@/hooks/auth';
import { useOpenActionModal } from '@/hooks/actionModal';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { useAuthedFetcher, useBackendApi } from '@/hooks/fetch';
import { msToDuration, tsToLocaleDateTimeString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';
import { cn, copyToClipboard } from '@/lib/utils';
import type { GenericApiOkResp } from '@shared/genericApiTypes';
import type { PlayerHistoryItem, PlayerModalResp, PlayerModalSuccess } from '@shared/playerApiTypes';
import {
    cadminApiPath,
    cadminCharacterIdentifier,
    cadminData,
    isCadminAvailable,
    toTxAdminLicense,
    type CadminPlayer,
    type CadminResponse,
} from '@/pages/CAdmin/api';
import { nativeSelectClass } from '@/pages/CAdmin/nativeSelect';
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

const playerListPath = '/administration/players';

export default function PlayerDetailPage() {
    const [, params] = useRoute('/administration/players/:license');
    const rawLicense = decodeURIComponent(params?.license ?? '');
    const license = toTxAdminLicense(rawLicense);
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const [selectedCharacterId, setSelectedCharacterId] = useState(() => (
        new URLSearchParams(window.location.search).get('character') || ''
    ));
    const [retryingCharacter, setRetryingCharacter] = useState(false);

    const txDetails = useSWR<PlayerModalSuccess>(license ? `/player?license=${encodeURIComponent(license)}` : null, async (url: string) => {
        const response = await fetcher<PlayerModalResp>(url);
        if ('error' in response) throw new Error(response.error);
        return response;
    });
    const cadminEnabled = isCadminAvailable();
    const canViewCharacter = hasPerm('cadmin.players.view');
    //Character management is entirely opt-in: when it is off (or the admin can't use it)
    //the page must not show character metrics, tabs or notices at all.
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
        <PageHeader title={t('Player Management')} />
        <Alert variant="destructive">{t('This is not a valid FiveM license.')}</Alert>
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
    const characterState = <CharacterManagementState
        state={characterLookupState}
        license={license}
        onRetry={() => void retryCharacter()}
    />;
    const showsCharacterId = canQueryCharacter && Boolean(selectedCharacterId);

    return <div className="flex w-full min-w-0 flex-col pb-10">
        <PageHeader title={displayName} parentName={t('Player Management')} parentLink={playerListPath}>
            <PlayerActions target={target} extended onChanged={refresh} className="flex flex-wrap gap-2" />
        </PageHeader>

        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isOnline ? 'success' : 'default'}>{isOnline ? t('Online') : t('Offline')}</Badge>
                    {character && <Badge className="font-mono">{character.group || 'user'}</Badge>}
                    {txPlayer?.isRegistered && <Badge variant="info">{t('Panel record')}</Badge>}
                </div>
                <CopyRow
                    value={showsCharacterId ? selectedCharacterId : `license:${license}`}
                    label={showsCharacterId ? t('Character') : undefined}
                />
            </div>

            {txDetails.error && <Alert variant="warning">
                {t('Panel record unavailable: {error}', { error: txDetails.error.message })}
            </Alert>}

            {canQueryCharacter && characterLookupState.kind !== 'ready' && !initialPlayerLoading && characterState}

            {characterList.data && characterList.data.length > 1 && <div className="flex flex-col gap-2 sm:max-w-md">
                <Label htmlFor="player-management-character">{t('Character')}</Label>
                <select
                    id="player-management-character"
                    className={nativeSelectClass}
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
                ? <p role="status" className="rounded-lg bg-raise p-4 text-sm text-muted-foreground sm:p-6">{t('Loading player management...')}</p>
                : <>
                    <dl className={cn('grid grid-cols-2 gap-4 rounded-lg bg-raise p-4 sm:p-6', canQueryCharacter ? 'lg:grid-cols-4' : 'lg:grid-cols-2')}>
                        <Metric label={t('Play time')} value={txPlayer?.playTime ? msToDuration(txPlayer.playTime * 60_000, { units: ['d', 'h', 'm'] }) : '—'} />
                        {canQueryCharacter && <Metric label={t('Cash')} value={character ? Number(character.money?.cash || 0).toLocaleString() : '—'} />}
                        {canQueryCharacter && <Metric label={t('Vehicles')} value={character ? String(character.vehicles?.length ?? 0) : '—'} />}
                        <Metric label={t('Sanctions')} value={String(txPlayer?.actionHistory.filter(action => !action.revokedAt).length ?? 0)} />
                    </dl>

                    <Tabs key={`${canQueryCharacter}`} defaultValue="overview" className="min-w-0">
                        <TabsList className="flex h-auto w-full flex-wrap justify-start">
                            <TabsTrigger value="overview">{t('Overview')}</TabsTrigger>
                            {canQueryCharacter && <TabsTrigger value="money">{t('Money')}</TabsTrigger>}
                            {canQueryCharacter && <TabsTrigger value="job">{t('Job')}</TabsTrigger>}
                            {canQueryCharacter && <TabsTrigger value="group">{t('Group')}</TabsTrigger>}
                            {canQueryCharacter && <TabsTrigger value="inventory">{t('Inventory')}</TabsTrigger>}
                            {canQueryCharacter && <TabsTrigger value="garage">{t('Garage')}</TabsTrigger>}
                            {txPlayer && <TabsTrigger value="history">{t('History')}</TabsTrigger>}
                            {txPlayer && <TabsTrigger value="identifiers">{t('Identifiers')}</TabsTrigger>}
                        </TabsList>

                        <TabsContent value="overview">
                            <OverviewTab player={txDetails.data} character={character} license={license} refresh={refresh} showCharacter={canQueryCharacter} />
                        </TabsContent>
                        {canQueryCharacter && <TabsContent value="money">{character
                            ? <MoneyTab player={character} refresh={refresh} />
                            : characterState}
                        </TabsContent>}
                        {canQueryCharacter && <TabsContent value="job">{character
                            ? <JobTab player={character} refresh={refresh} />
                            : characterState}
                        </TabsContent>}
                        {canQueryCharacter && <TabsContent value="group">{character
                            ? <GroupTab player={character} refresh={refresh} />
                            : characterState}
                        </TabsContent>}
                        {canQueryCharacter && <TabsContent value="inventory">{character
                            ? <InventoryTab player={character} refresh={refresh} />
                            : characterState}
                        </TabsContent>}
                        {canQueryCharacter && <TabsContent value="garage">{character
                            ? <GarageTab player={character} refresh={refresh} />
                            : characterState}
                        </TabsContent>}
                        {txPlayer && <TabsContent value="history"><HistoryTab actions={txPlayer.actionHistory} serverTime={txDetails.data!.serverTime} /></TabsContent>}
                        {txPlayer && <TabsContent value="identifiers"><IdentifiersTab license={license} player={txPlayer} refresh={refresh} /></TabsContent>}
                    </Tabs>
                </>}
        </div>
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
    if (state.kind === 'loading') {
        return <p role="status" className="rounded-lg bg-raise p-4 text-sm text-muted-foreground sm:p-6">{state.message}</p>;
    }
    return <Alert
        variant={isError ? 'destructive' : isLocked ? 'warning' : 'default'}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
        <div className="min-w-0">
            <AlertTitle>{t('Character Management')}</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">license:{license}</p>
        </div>
        {(isError || state.kind === 'empty') && <Button size="sm" variant="secondary" className="self-start sm:self-auto" onClick={onRetry}>
            {t('Try again')}
        </Button>}
    </Alert>;
}

function Metric({ label, value }: { label: string; value: string }) {
    return <div className="min-w-0">
        <dt className="text-dense text-muted-foreground">{label}</dt>
        <dd className="mt-1 truncate text-lg font-semibold tabular-nums text-white">{value}</dd>
    </div>;
}

function OverviewTab({
    player,
    character,
    license,
    refresh,
    showCharacter,
}: {
    player?: PlayerModalSuccess;
    character?: CadminPlayer;
    license: string;
    refresh: () => void;
    showCharacter: boolean;
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

    return <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
            <Section>
                <dl className="grid gap-4 sm:grid-cols-2">
                    <Detail label={t('Connection')} value={txPlayer?.isConnected ? t('Connected') : t('Offline')} />
                    <Detail label={t('First joined')} value={txPlayer?.tsJoined ? tsToLocaleDateTimeString(txPlayer.tsJoined, 'medium', 'short') : '—'} />
                    <Detail label={t('Last connection')} value={txPlayer?.tsLastConnection ? tsToLocaleDateTimeString(txPlayer.tsLastConnection, 'medium', 'short') : '—'} />
                    <div className="min-w-0">
                        <dt className="text-dense text-muted-foreground">{t('Allowlist')}</dt>
                        <dd className="mt-1 flex flex-wrap items-center gap-3">
                            <span className="text-sm text-white">{txPlayer?.tsWhitelisted ? t('Allowed') : t('Not allowed')}</span>
                            <Button size="xs" variant="secondary" disabled={!txPlayer || !hasPerm('players.whitelist')} onClick={toggleAllowlist}>
                                {txPlayer?.tsWhitelisted ? t('Remove from allowlist') : t('Add to allowlist')}
                            </Button>
                        </dd>
                    </div>
                    {character && <Detail label={t('Job')} value={`${character.job?.label || character.job?.name || t('None')} · ${t('Grade {grade}', { grade: character.job?.grade ?? 0 })}`} />}
                    {character && <Detail label={t('Framework group')} value={character.group || 'user'} />}
                </dl>
            </Section>
            {txPlayer && <Section>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="player-management-notes">{t('Staff notes')}</Label>
                    <Textarea id="player-management-notes" value={notes} disabled={!txPlayer.isRegistered} onChange={event => setNotes(event.target.value)} placeholder={t('Write an internal note about this player.')} />
                    <p className="text-dense text-muted-foreground">{txPlayer.notesLog || t('Only panel staff can see these notes.')}</p>
                </div>
                <Button className="mt-4" disabled={saving || !txPlayer.isRegistered} onClick={saveNote}>{t('Save note')}</Button>
            </Section>}
        </div>
        {showCharacter && <section className="flex min-w-0 flex-col gap-3" aria-labelledby="player-character-record">
            <h2 id="player-character-record" className="text-base font-semibold text-white">{t('Character record')}</h2>
            {character ? <>
                <CopyRow value={cadminCharacterIdentifier(character)} label={t('Character')} />
                {character.playerLicense
                    ? <CopyRow value={character.playerLicense} />
                    : <p className="text-dense text-muted-foreground">{t('No account identifier reported.')}</p>}
            </> : <EmptyState message={t('No framework character selected.')} />}
        </section>}
    </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
    return <div className="min-w-0">
        <dt className="text-dense text-muted-foreground">{label}</dt>
        <dd className="mt-1 break-words text-sm text-white">{value}</dd>
    </div>;
}

function HistoryTab({ actions, serverTime }: { actions: PlayerHistoryItem[]; serverTime: number }) {
    const openAction = useOpenActionModal();
    return <section className="flex flex-col gap-3" aria-labelledby="player-history-heading">
        <h2 id="player-history-heading" className="text-base font-semibold text-white">{t('Sanctions')}</h2>
        {!actions.length
            ? <EmptyState message={t('No bans or warnings recorded.')} />
            : <ListRows>{[...actions].reverse().map(action => {
                const active = !action.revokedAt && (!action.exp || action.exp > serverTime);
                return <ListRow key={action.id} interactive className="p-0 sm:p-0">
                    <button
                        type="button"
                        className="flex min-h-11 w-full min-w-0 flex-col gap-2 rounded-lg px-4 py-3 text-left sm:px-5 md:flex-row md:items-center md:justify-between"
                        onClick={() => openAction(action.id)}
                    >
                        <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                                <Badge variant={action.type === 'ban' ? 'danger' : 'warning'}>{t(action.type === 'ban' ? 'Ban' : 'Warning')}</Badge>
                                <span className="font-mono text-xs text-muted-foreground">{action.id}</span>
                            </span>
                            <span className="mt-1 block break-words text-sm text-body">{action.reason}</span>
                        </span>
                        <span className="flex shrink-0 flex-wrap items-center gap-2 text-dense text-muted-foreground">
                            <span>{action.author} · <span className="tabular-nums">{tsToLocaleDateTimeString(action.ts, 'medium', 'short')}</span></span>
                            <Badge variant={active ? 'info' : 'default'}>{active ? t('Active') : t('Inactive')}</Badge>
                        </span>
                    </button>
                </ListRow>;
            })}</ListRows>}
    </section>;
}

function IdentifierRow({ identifier, isOnline, canRemove, onRemove }: {
    identifier: string;
    isOnline: boolean;
    canRemove: boolean;
    onRemove: () => void;
}) {
    const rowRef = useRef<HTMLDivElement>(null);
    const handleCopy = async () => {
        if (!rowRef.current) return;
        try {
            const result = await copyToClipboard(identifier, rowRef.current);
            if (result === false) throw new Error('copy failed');
            txToast.success(t('Copied to clipboard.'));
        } catch (error) {
            txToast.error(t('Could not copy to the clipboard.'));
        }
    };
    return <ListRow className="py-1 pr-1 sm:pr-1">
        <div ref={rowRef} className="min-w-0 flex-1 py-1">
            <code className="block break-all font-mono text-dense text-white">{identifier}</code>
            <p className="mt-0.5 text-xs text-muted-foreground">{isOnline ? t('Active this session') : t('Saved history')}</p>
        </div>
        <IconButton label={t('Copy')} icon={<CopyIcon />} onClick={() => void handleCopy()} />
        <IconButton
            label={t('Remove identifier')}
            icon={<Trash2Icon />}
            variant="ghost-destructive"
            disabled={!canRemove}
            onClick={onRemove}
        />
    </ListRow>;
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

    return <section className="flex flex-col gap-3" aria-labelledby="player-identifiers-heading">
        <div>
            <h2 id="player-identifiers-heading" className="text-base font-semibold text-white">{t('Identifiers')}</h2>
            <p className="mt-1 text-dense text-muted-foreground">{t('Online identifiers are protected until the player disconnects.')}</p>
        </div>
        {identifiers.length
            ? <ListRows>
                {identifiers.map(identifier => {
                    const isOnline = online.has(identifier);
                    const protectedLicense = identifier.startsWith('license:') || identifier.startsWith('license2:');
                    return <IdentifierRow
                        key={identifier}
                        identifier={identifier}
                        isOnline={isOnline}
                        canRemove={hasPerm('players.remove_ids') && !isOnline && !protectedLicense}
                        onRemove={() => remove(identifier)}
                    />;
                })}
            </ListRows>
            : <EmptyState message={t('No identifiers recorded.')} />}
    </section>;
}
