import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, CopyIcon } from 'lucide-react';
import consts from '@shared/consts';
import { PageHeader } from '@/components/page-header';
import { txToast } from '@/components/TxToaster';
import { ListRow, ListRows } from '@/components/ListRow';
import EmptyState from '@/components/EmptyState';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPerms } from '@/hooks/auth';
import { useOpenConfirmDialog, useOpenPromptDialog } from '@/hooks/dialogs';
import { useAuthedFetcher } from '@/hooks/fetch';
import { tsToLocaleDateTimeString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';
import { copyToClipboard } from '@/lib/utils';
import SettingsPage from '@/pages/Settings/SettingsPage';

type AllowlistRequest = {
    id: string;
    license: string;
    playerDisplayName: string;
    playerPureName: string;
    discordTag?: string;
    discordAvatar?: string;
    tsLastAttempt: number;
};

type AllowlistApproval = {
    identifier: string;
    playerName: string;
    playerAvatar: string | null;
    tsApproved: number;
    approvedBy: string;
};

type RequestsResponse = {
    cntTotal: number;
    cntFiltered: number;
    currentWhitelistMode: string;
    newest: number;
    totalPages: number;
    currPage: number;
    requests: AllowlistRequest[];
} | { error: string };

type ApprovalsResponse = AllowlistApproval[] | { error: string };
type ActionResponse = { success?: boolean; error?: string };

const modeLabels: Record<string, string> = {
    disabled: 'Disabled',
    adminOnly: 'Admin-only',
    approvedLicense: 'Approved license',
    discordMember: 'Discord server members',
    discordRoles: 'Discord server roles',
    external: 'External resource',
};

function Initials({ name }: { name: string }) {
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase();
    return <>{initials || '?'}</>;
}

function Stat({ label, value, live }: { label: string; value: React.ReactNode; live?: boolean }) {
    return <div className="min-w-0">
        <dt className="text-dense text-muted-foreground">{label}</dt>
        <dd className={`mt-1 truncate text-lg font-semibold text-white ${live ? 'tabular-nums' : ''}`}>{value}</dd>
    </div>;
}

/** Icon-only copy button for an identifier shown in a row. */
function CopyIdButton({ value }: { value: string }) {
    const surrogateRef = useRef<HTMLDivElement>(null);
    const handleCopy = async () => {
        if (!surrogateRef.current) return;
        try {
            const result = await copyToClipboard(value, surrogateRef.current);
            if (result === false) throw new Error('copy failed');
            txToast.success(t('Copied to clipboard.'));
        } catch (error) {
            txToast.error(t('Could not copy to the clipboard.'));
        }
    };
    return <div ref={surrogateRef} className="shrink-0">
        <IconButton label={t('Copy identifier')} icon={<CopyIcon />} onClick={() => void handleCopy()} />
    </div>;
}

//Toolbar search: 44px on phones, 36px with 13px text from 640px.
const toolbarInputClass = 'h-11 text-dense sm:h-9';

export default function AllowlistPage() {
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const openConfirmDialog = useOpenConfirmDialog();
    const openPromptDialog = useOpenPromptDialog();
    const canManage = hasPerm('players.whitelist');
    const [activeTab, setActiveTab] = useState('requests');
    const [searchDraft, setSearchDraft] = useState('');
    const [requestSearch, setRequestSearch] = useState('');
    const [approvalSearch, setApprovalSearch] = useState('');
    const [page, setPage] = useState(1);
    const [busyAction, setBusyAction] = useState<string>();

    const requestUrl = `/whitelist/requests?page=${page}${requestSearch ? `&searchString=${encodeURIComponent(requestSearch)}` : ''}`;
    const requestsSWR = useSWR(requestUrl, async (url) => {
        const response = await fetcher<RequestsResponse>(url);
        if ('error' in response) throw new Error(response.error);
        return response;
    }, { keepPreviousData: true });
    const approvalsSWR = useSWR('/whitelist/approvals', async (url) => {
        const response = await fetcher<ApprovalsResponse>(url);
        if (!Array.isArray(response)) throw new Error(response.error);
        return response;
    });

    useEffect(() => {
        const totalPages = requestsSWR.data?.totalPages || 1;
        if (page > totalPages) setPage(totalPages);
    }, [page, requestsSWR.data?.totalPages]);

    const filteredApprovals = useMemo(() => {
        const query = approvalSearch.trim().toLocaleLowerCase();
        if (!query) return approvalsSWR.data ?? [];
        return (approvalsSWR.data ?? []).filter(approval => (
            approval.playerName.toLocaleLowerCase().includes(query)
            || approval.identifier.toLocaleLowerCase().includes(query)
            || approval.approvedBy.toLocaleLowerCase().includes(query)
        ));
    }, [approvalSearch, approvalsSWR.data]);

    const refreshLists = async () => {
        await Promise.all([requestsSWR.mutate(), approvalsSWR.mutate()]);
    };

    const runAction = async (key: string, url: string, body: Record<string, unknown>, successMessage: string) => {
        setBusyAction(key);
        const toastId = txToast.loading(t('Working…'));
        try {
            const response = await fetcher<ActionResponse>(url, { method: 'POST', body });
            if (response.success !== true) {
                txToast.error({ title: t('Action failed'), msg: t(response.error || 'Unknown error.') }, { id: toastId });
                return;
            }
            txToast.success(successMessage, { id: toastId });
            await refreshLists();
        } catch (error) {
            txToast.error({
                title: t('Request failed'),
                msg: t(error instanceof Error ? error.message : 'Unknown error.'),
            }, { id: toastId });
        } finally {
            setBusyAction(undefined);
        }
    };

    const openAddApproval = () => {
        if (!canManage) return;
        const identifierTypes = Object.keys(consts.validIdentifiers).join(', ');
        openPromptDialog({
            title: t('Allowlist a player'),
            message: <span>{t('Enter a full player identifier. Supported types: {types}.', { types: identifierTypes })}</span>,
            placeholder: t('license:0123456789abcdef0123456789abcdef01234567'),
            required: true,
            cancelLabel: t('Cancel'),
            submitLabel: t('Add approval'),
            onSubmit: (rawIdentifier) => {
                const identifier = rawIdentifier.trim();
                const isValid = Object.values(consts.validIdentifiers).some(pattern => pattern.test(identifier));
                if (!isValid) {
                    txToast.error({ title: t('Invalid identifier'), msg: t('Enter a complete supported player identifier.') });
                    return;
                }
                void runAction('add', '/whitelist/approvals/add', { identifier }, t('Player added to the allowlist.'));
            },
        });
    };

    const mode = requestsSWR.data?.currentWhitelistMode;
    const modeIsActive = mode === 'approvedLicense';
    const requestCount = requestsSWR.data?.cntTotal ?? 0;
    const approvalCount = approvalsSWR.data?.length ?? 0;
    const totalPages = Math.max(1, requestsSWR.data?.totalPages || 1);

    const requests = requestsSWR.data?.requests ?? [];

    return <div className="pb-8">
        <PageHeader title={t('Allowlist')}>
            <Button onClick={openAddApproval} disabled={!canManage || Boolean(busyAction)} title={!canManage ? t('You do not have permission to manage the allowlist.') : undefined}>
                {t('Add player')}
            </Button>
        </PageHeader>

        <div className="flex flex-col gap-6">
            <dl className="grid gap-4 rounded-lg bg-raise p-4 sm:grid-cols-3 sm:p-6">
                <Stat label={t('Mode')} value={mode ? t(modeLabels[mode] || 'Unknown') : t('Loading…')} />
                <Stat live label={t('Join requests')} value={requestsSWR.isLoading ? '—' : requestCount.toLocaleString(window.txBrowserLocale)} />
                <Stat live label={t('Approved, pending join')} value={approvalsSWR.isLoading ? '—' : approvalCount.toLocaleString(window.txBrowserLocale)} />
            </dl>

            {mode && !modeIsActive && <Alert variant="warning">
                <AlertDescription>
                    {t('Changes made here only control joins while the Approved License mode is active.')}{' '}
                    <Button variant="link" className="text-sm" onClick={() => setActiveTab('settings')}>{t('Open allowlist settings')}</Button>
                </AlertDescription>
            </Alert>}

            {!canManage && <Alert variant="info">
                <AlertDescription>{t('You can review the allowlist, but your account cannot approve or remove players.')}</AlertDescription>
            </Alert>}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="requests">{t('Requests')}</TabsTrigger>
                    <TabsTrigger value="approved">{t('Approved')}</TabsTrigger>
                    <TabsTrigger value="settings">{t('Settings')}</TabsTrigger>
                </TabsList>

                <TabsContent value="requests" className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <form className="flex w-full max-w-xl flex-wrap gap-2 sm:flex-nowrap" onSubmit={(event) => {
                            event.preventDefault();
                            setPage(1);
                            setRequestSearch(searchDraft.trim());
                        }}>
                            <Input
                                value={searchDraft}
                                onChange={event => setSearchDraft(event.target.value)}
                                className={`${toolbarInputClass} min-w-0 flex-1 basis-full sm:basis-auto`}
                                aria-label={t('Search')}
                                placeholder={t('Search by player name, Discord, or request ID')}
                            />
                            <Button type="submit" variant="secondary" size="sm">{t('Search')}</Button>
                            {requestSearch && <Button type="button" variant="secondary" size="sm" onClick={() => { setSearchDraft(''); setRequestSearch(''); setPage(1); }}>{t('Clear')}</Button>}
                        </form>
                        <Button
                            variant="outline-destructive"
                            size="sm"
                            className="self-start lg:self-auto"
                            disabled={!canManage || !requestsSWR.data?.requests.length || Boolean(busyAction)}
                            onClick={() => openConfirmDialog({
                                title: t('Deny all visible requests?'),
                                message: t('Only the requests shown on this page will be removed. Players can request access again.'),
                                cancelLabel: t('Cancel'),
                                actionLabel: t('Deny all'),
                                confirmBtnVariant: 'destructive',
                                onConfirm: () => void runAction(
                                    'deny-all',
                                    '/whitelist/requests/deny_visible',
                                    { requestIds: requestsSWR.data?.requests.map(request => request.id) ?? [] },
                                    t('Allowlist requests denied.'),
                                ),
                            })}
                        >
                            {t('Deny all')}
                        </Button>
                    </div>

                    {requestsSWR.error && <Alert variant="destructive"><AlertDescription>{t(requestsSWR.error.message)}</AlertDescription></Alert>}
                    {requestsSWR.isLoading && !requestsSWR.data && <p role="status" className="text-sm text-muted-foreground">{t('Loading requests…')}</p>}
                    {requestsSWR.data && <section className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <h2 className="text-base font-semibold text-white">{t('Join requests')}</h2>
                            <p className="text-dense tabular-nums text-muted-foreground">{requestSearch
                                ? t('{filtered} of {total} requests', { filtered: requestsSWR.data.cntFiltered, total: requestsSWR.data.cntTotal })
                                : t('{count} requests', { count: requestsSWR.data.cntTotal })}</p>
                        </div>
                        {requests.length ? <ListRows>
                            {requests.map(request => <ListRow key={request.id} className="flex-col items-stretch sm:flex-row sm:items-center">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <Avatar className="size-9">
                                        {request.discordAvatar && <AvatarImage src={request.discordAvatar} alt="" />}
                                        <AvatarFallback className="text-micro"><Initials name={request.discordTag || request.playerDisplayName} /></AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">{request.playerDisplayName}</p>
                                        <p className="truncate text-dense text-muted-foreground">
                                            {request.discordTag || t('Not available')}
                                            {' · '}
                                            <span className="tabular-nums">{tsToLocaleDateTimeString(request.tsLastAttempt, 'medium', 'short')}</span>
                                        </p>
                                        <div className="flex min-w-0 items-center gap-1">
                                            <code className="min-w-0 break-all font-mono text-xs text-muted-foreground">{request.id} · license:{request.license}</code>
                                            <CopyIdButton value={`license:${request.license}`} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <Button size="sm" variant="secondary" disabled={!canManage || Boolean(busyAction)} onClick={() => void runAction(`approve-${request.id}`, '/whitelist/requests/approve', { reqId: request.id }, t('Request approved.'))}>
                                        {busyAction === `approve-${request.id}` ? t('Working…') : t('Approve')}
                                    </Button>
                                    <Button size="sm" variant="outline-destructive" disabled={!canManage || Boolean(busyAction)} onClick={() => void runAction(`deny-${request.id}`, '/whitelist/requests/deny', { reqId: request.id }, t('Request denied.'))}>
                                        {busyAction === `deny-${request.id}` ? t('Working…') : t('Deny')}
                                    </Button>
                                </div>
                            </ListRow>)}
                        </ListRows> : <EmptyState message={requestSearch ? t('No requests match that search.') : t('There are no pending allowlist requests.')} />}
                        <div className="flex items-center justify-end gap-2">
                            <IconButton label={t('Previous page')} icon={<ChevronLeft />} disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} />
                            <span className="min-w-24 text-center text-dense tabular-nums text-muted-foreground">{t('Page {current} of {total}', { current: page, total: totalPages })}</span>
                            <IconButton label={t('Next page')} icon={<ChevronRight />} disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} />
                        </div>
                    </section>}
                </TabsContent>

                <TabsContent value="approved" className="flex flex-col gap-6">
                    <Input
                        value={approvalSearch}
                        onChange={event => setApprovalSearch(event.target.value)}
                        className={`${toolbarInputClass} max-w-xl`}
                        aria-label={t('Search')}
                        placeholder={t('Search approved players or identifiers')}
                    />

                    {approvalsSWR.error && <Alert variant="destructive"><AlertDescription>{t(approvalsSWR.error.message)}</AlertDescription></Alert>}
                    {approvalsSWR.isLoading && <p role="status" className="text-sm text-muted-foreground">{t('Loading approvals…')}</p>}
                    {approvalsSWR.data && <section className="flex flex-col gap-3">
                        <h2 className="text-base font-semibold text-white">{t('Approved, pending join')}</h2>
                        {filteredApprovals.length ? <ListRows>
                            {filteredApprovals.map(approval => <ListRow key={approval.identifier} className="flex-col items-stretch sm:flex-row sm:items-center">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <Avatar className="size-9">
                                        {approval.playerAvatar && <AvatarImage src={approval.playerAvatar} alt="" />}
                                        <AvatarFallback className="text-micro"><Initials name={approval.playerName} /></AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">{approval.playerName}</p>
                                        <p className="truncate text-dense text-muted-foreground">
                                            {t('Approved by')} {approval.approvedBy}
                                            {' · '}
                                            <span className="tabular-nums">{tsToLocaleDateTimeString(approval.tsApproved, 'medium', 'short')}</span>
                                        </p>
                                        <div className="flex min-w-0 items-center gap-1">
                                            <code className="min-w-0 break-all font-mono text-xs text-muted-foreground">{approval.identifier}</code>
                                            <CopyIdButton value={approval.identifier} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <Button size="sm" variant="outline-destructive" disabled={!canManage || Boolean(busyAction)} onClick={() => openConfirmDialog({
                                        title: t('Remove this approval?'),
                                        message: t('{player} will no longer be approved through this allowlist entry.', { player: approval.playerName }),
                                        cancelLabel: t('Cancel'),
                                        actionLabel: t('Remove'),
                                        confirmBtnVariant: 'destructive',
                                        onConfirm: () => void runAction(`remove-${approval.identifier}`, '/whitelist/approvals/remove', { identifier: approval.identifier }, t('Approval removed.')),
                                    })}>
                                        {busyAction === `remove-${approval.identifier}` ? t('Working…') : t('Remove')}
                                    </Button>
                                </div>
                            </ListRow>)}
                        </ListRows> : <EmptyState message={approvalSearch ? t('No approvals match that search.') : t('No players are waiting to join.')} />}
                    </section>}
                </TabsContent>
                <TabsContent value="settings">
                    <SettingsPage embeddedAllowlist />
                </TabsContent>
            </Tabs>
        </div>
    </div>;
}
