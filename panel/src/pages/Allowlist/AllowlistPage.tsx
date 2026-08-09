import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    Check, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Search,
    ShieldAlert, Trash2, UserPlus, X,
} from 'lucide-react';
import consts from '@shared/consts';
import { PageHeader } from '@/components/page-header';
import { txToast } from '@/components/TxToaster';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPerms } from '@/hooks/auth';
import { useOpenConfirmDialog, useOpenPromptDialog } from '@/hooks/dialogs';
import { useAuthedFetcher } from '@/hooks/fetch';
import { tsToLocaleDateTimeString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';
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

function Stat({ label, value, tone = 'default' }: { label: string; value: React.ReactNode; tone?: 'default' | 'warning' }) {
    return <div className="rounded-xl border border-white/5 bg-white/[0.035] px-4 py-3">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`mt-1 truncate text-lg font-semibold ${tone === 'warning' ? 'text-amber-300' : 'text-white'}`}>{value}</p>
    </div>;
}

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

    return <div className="pb-8">
        <PageHeader title={t('Allowlist')} icon={<ClipboardCheck className="size-6" />}>
            <Button onClick={openAddApproval} disabled={!canManage || Boolean(busyAction)} title={!canManage ? t('You do not have permission to manage the allowlist.') : undefined}>
                <UserPlus className="mr-2 size-4" />{t('Add player')}
            </Button>
        </PageHeader>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Stat label={t('Mode')} value={mode ? t(modeLabels[mode] || 'Unknown') : t('Loading…')} tone={mode && !modeIsActive ? 'warning' : 'default'} />
            <Stat label={t('Join requests')} value={requestsSWR.isLoading ? '—' : requestCount.toLocaleString(window.txBrowserLocale)} />
            <Stat label={t('Approved, pending join')} value={approvalsSWR.isLoading ? '—' : approvalCount.toLocaleString(window.txBrowserLocale)} />
        </div>

        {mode && !modeIsActive && <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>{t('Changes made here only control joins while the Approved License mode is active.')} {' '}
                <button type="button" onClick={() => setActiveTab('settings')} className="font-medium text-amber-100 underline">{t('Open allowlist settings')}</button>
            </p>
        </div>}

        {!canManage && <div className="mb-5 rounded-xl border border-white/5 bg-white/[0.035] px-4 py-3 text-sm text-zinc-400">
            {t('You can review the allowlist, but your account cannot approve or remove players.')}
        </div>}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-white/[0.035] p-1 sm:w-[26rem]">
                <TabsTrigger value="requests" className="rounded-lg">
                    {t('Requests')}<Badge variant="secondary" className="ml-2 border-0 bg-white/5">{requestCount}</Badge>
                </TabsTrigger>
                <TabsTrigger value="approved" className="rounded-lg">
                    {t('Approved')}<Badge variant="secondary" className="ml-2 border-0 bg-white/5">{approvalCount}</Badge>
                </TabsTrigger>
                <TabsTrigger value="settings" className="rounded-lg">{t('Settings')}</TabsTrigger>
            </TabsList>

            <TabsContent value="requests" className="mt-4">
                <Card className="overflow-hidden">
                    <div className="flex flex-col gap-3 border-b border-white/5 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <form className="flex w-full max-w-xl gap-2" onSubmit={(event) => {
                            event.preventDefault();
                            setPage(1);
                            setRequestSearch(searchDraft.trim());
                        }}>
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                                <Input value={searchDraft} onChange={event => setSearchDraft(event.target.value)} className="pl-9" placeholder={t('Search by player name, Discord, or request ID')} />
                            </div>
                            <Button type="submit" variant="outline">{t('Search')}</Button>
                            {requestSearch && <Button type="button" variant="ghost-muted" onClick={() => { setSearchDraft(''); setRequestSearch(''); setPage(1); }}>{t('Clear')}</Button>}
                        </form>
                        <Button
                            variant="outline-destructive"
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
                            <Trash2 className="mr-2 size-4" />{t('Deny all')}
                        </Button>
                    </div>

                    <CardContent className="p-0">
                        {requestsSWR.error && <p className="px-5 py-10 text-center text-sm text-red-300">{t(requestsSWR.error.message)}</p>}
                        {requestsSWR.isLoading && !requestsSWR.data && <p className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />{t('Loading requests…')}</p>}
                        {requestsSWR.data && <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead className="border-b border-white/5 text-xs text-zinc-500">
                                        <tr>
                                            <th className="px-5 py-3 text-left font-medium">{t('Player')}</th>
                                            <th className="px-5 py-3 text-left font-medium">{t('Discord')}</th>
                                            <th className="px-5 py-3 text-left font-medium">{t('Last attempt')}</th>
                                            <th className="px-5 py-3 text-right font-medium">{t('Actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {requestsSWR.data.requests.map(request => <tr key={request.id} className="transition-colors hover:bg-white/[0.025]">
                                            <td className="px-5 py-4">
                                                <p className="font-medium text-white">{request.playerDisplayName}</p>
                                                <p className="mt-1 font-mono text-xs text-zinc-600">{request.id} · license:{request.license}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="size-8 border border-white/5">
                                                        {request.discordAvatar && <AvatarImage src={request.discordAvatar} alt="" />}
                                                        <AvatarFallback className="text-[10px]"><Initials name={request.discordTag || request.playerDisplayName} /></AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-zinc-300">{request.discordTag || t('Not available')}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-zinc-400">{tsToLocaleDateTimeString(request.tsLastAttempt, 'medium', 'short')}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline-success" disabled={!canManage || Boolean(busyAction)} onClick={() => void runAction(`approve-${request.id}`, '/whitelist/requests/approve', { reqId: request.id }, t('Request approved.'))}>
                                                        {busyAction === `approve-${request.id}` ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}{t('Approve')}
                                                    </Button>
                                                    <Button size="sm" variant="outline-destructive" disabled={!canManage || Boolean(busyAction)} onClick={() => void runAction(`deny-${request.id}`, '/whitelist/requests/deny', { reqId: request.id }, t('Request denied.'))}>
                                                        {busyAction === `deny-${request.id}` ? <Loader2 className="mr-2 size-4 animate-spin" /> : <X className="mr-2 size-4" />}{t('Deny')}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>)}
                                    </tbody>
                                </table>
                            </div>
                            {!requestsSWR.data.requests.length && <p className="px-5 py-14 text-center text-sm text-zinc-500">{requestSearch ? t('No requests match that search.') : t('There are no pending allowlist requests.')}</p>}
                            <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
                                <p className="text-xs text-zinc-500">{requestSearch
                                    ? t('{filtered} of {total} requests', { filtered: requestsSWR.data.cntFiltered, total: requestsSWR.data.cntTotal })
                                    : t('{count} requests', { count: requestsSWR.data.cntTotal })}</p>
                                <div className="flex items-center gap-2">
                                    <Button size="icon" variant="ghost-muted" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} aria-label={t('Previous page')}><ChevronLeft className="size-4" /></Button>
                                    <span className="min-w-24 text-center text-xs text-zinc-400">{t('Page {current} of {total}', { current: page, total: totalPages })}</span>
                                    <Button size="icon" variant="ghost-muted" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} aria-label={t('Next page')}><ChevronRight className="size-4" /></Button>
                                </div>
                            </div>
                        </>}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="approved" className="mt-4">
                <Card className="overflow-hidden">
                    <div className="border-b border-white/5 p-4">
                        <div className="relative max-w-xl">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                            <Input value={approvalSearch} onChange={event => setApprovalSearch(event.target.value)} className="pl-9" placeholder={t('Search approved players or identifiers')} />
                        </div>
                    </div>
                    <CardContent className="p-0">
                        {approvalsSWR.error && <p className="px-5 py-10 text-center text-sm text-red-300">{t(approvalsSWR.error.message)}</p>}
                        {approvalsSWR.isLoading && <p className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />{t('Loading approvals…')}</p>}
                        {approvalsSWR.data && <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px] text-sm">
                                    <thead className="border-b border-white/5 text-xs text-zinc-500">
                                        <tr>
                                            <th className="px-5 py-3 text-left font-medium">{t('Player')}</th>
                                            <th className="px-5 py-3 text-left font-medium">{t('Approved by')}</th>
                                            <th className="px-5 py-3 text-left font-medium">{t('Approved on')}</th>
                                            <th className="px-5 py-3 text-right font-medium">{t('Actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredApprovals.map(approval => <tr key={approval.identifier} className="transition-colors hover:bg-white/[0.025]">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="size-9 border border-white/5">
                                                        {approval.playerAvatar && <AvatarImage src={approval.playerAvatar} alt="" />}
                                                        <AvatarFallback className="text-[10px]"><Initials name={approval.playerName} /></AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0"><p className="truncate font-medium text-white">{approval.playerName}</p><p className="truncate font-mono text-xs text-zinc-600">{approval.identifier}</p></div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-zinc-300">{approval.approvedBy}</td>
                                            <td className="px-5 py-4 text-zinc-400">{tsToLocaleDateTimeString(approval.tsApproved, 'medium', 'short')}</td>
                                            <td className="px-5 py-4 text-right">
                                                <Button size="sm" variant="outline-destructive" disabled={!canManage || Boolean(busyAction)} onClick={() => openConfirmDialog({
                                                    title: t('Remove this approval?'),
                                                    message: t('{player} will no longer be approved through this allowlist entry.', { player: approval.playerName }),
                                                    cancelLabel: t('Cancel'),
                                                    actionLabel: t('Remove'),
                                                    confirmBtnVariant: 'destructive',
                                                    onConfirm: () => void runAction(`remove-${approval.identifier}`, '/whitelist/approvals/remove', { identifier: approval.identifier }, t('Approval removed.')),
                                                })}>
                                                    {busyAction === `remove-${approval.identifier}` ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}{t('Remove')}
                                                </Button>
                                            </td>
                                        </tr>)}
                                    </tbody>
                                </table>
                            </div>
                            {!filteredApprovals.length && <p className="px-5 py-14 text-center text-sm text-zinc-500">{approvalSearch ? t('No approvals match that search.') : t('No players are waiting to join.')}</p>}
                        </>}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
                <SettingsPage embeddedAllowlist />
            </TabsContent>
        </Tabs>
    </div>;
}
