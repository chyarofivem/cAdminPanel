import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    ChevronDown, ChevronUp, Folder, FolderSync, Loader2, Play, RefreshCw,
    RotateCcw, Search, Square, Wrench,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { txToast } from '@/components/TxToaster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAdminPerms } from '@/hooks/auth';
import { useAuthedFetcher } from '@/hooks/fetch';
import { tsToLocaleDateTimeString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';

type ResourceEntry = {
    name: string;
    status: string;
    group: string;
    version: string;
    author: string;
    description: string;
};

type ResourcesResponse = {
    success: true;
    data: {
        generatedAt: number;
        resources: ResourceEntry[];
    };
} | {
    success: false;
    error: 'server_offline' | 'report_unavailable' | 'report_timeout';
};

type ResourceActionResponse = {
    type: 'default' | 'loading' | 'info' | 'success' | 'warning' | 'error';
    msg: string;
};

type StatusFilter = 'all' | 'running' | 'stopped';
type ReportError = 'server_offline' | 'report_unavailable' | 'report_timeout';

const builtInResourceNames = new Set([
    'baseevents', 'basic-gamemode', 'betaguns', 'channelfeed', 'chat-theme-gtao', 'chat',
    'example-loadscreen', 'fivem-awesome1501', 'fivem-map-hipster', 'fivem-map-skater',
    'fivem', 'gameInit', 'hardcap', 'irc', 'keks', 'mapmanager', 'money-fountain-example-map',
    'money-fountain', 'money', 'monitor', 'obituary-deaths', 'obituary', 'ped-money-drops',
    'player-data', 'playernames', 'race-test', 'race', 'rconlog', 'redm-map-one', 'runcode',
    'scoreboard', 'sessionmanager-rdr3', 'sessionmanager', 'spawnmanager', 'webadmin', 'webpack', 'yarn',
]);

const reportErrors: Record<ReportError, string> = {
    server_offline: 'Start the server to inspect its resources.',
    report_unavailable: 'The resource report could not be requested.',
    report_timeout: 'The server did not return a resource report in time.',
};

const statusLabel = (status: string) => {
    if (status === 'started') return t('Running');
    if (status === 'stopped') return t('Stopped');
    if (status === 'starting') return t('Starting');
    return t('Unknown');
};

const statusClasses = (status: string) => {
    if (status === 'started') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    if (status === 'stopped') return 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400';
    return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
};

function readStoredBoolean(key: string, fallback: boolean) {
    try {
        const stored = window.localStorage.getItem(key);
        return stored === null ? fallback : stored === 'true';
    } catch {
        return fallback;
    }
}

function readCollapsedGroups() {
    try {
        const parsed = JSON.parse(window.localStorage.getItem('resourcesPageCollapsedGroups') || '[]');
        return new Set<string>(Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : []);
    } catch {
        return new Set<string>();
    }
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
    return <div className="rounded-xl border border-white/5 bg-white/[0.035] px-4 py-3">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`mt-1 text-lg font-semibold ${color || 'text-white'}`}>{value.toLocaleString(window.txBrowserLocale)}</p>
    </div>;
}

export default function ResourcesPage() {
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const canControl = hasPerm('commands.resources');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showBuiltIn, setShowBuiltIn] = useState(() => readStoredBoolean('resourcesPageShowDefault', false));
    const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);
    const [busyResource, setBusyResource] = useState<string>();
    const [isRescanning, setIsRescanning] = useState(false);

    const resourcesSWR = useSWR('/resources/data', async (url) => {
        const response = await fetcher<ResourcesResponse>(url);
        if (!response.success) throw new Error(response.error);
        return response.data;
    }, { revalidateOnFocus: false });

    const resources = resourcesSWR.data?.resources ?? [];
    const runningCount = resources.filter(resource => resource.status === 'started').length;
    const stoppedCount = resources.filter(resource => resource.status === 'stopped').length;

    const groupedResources = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        const filtered = resources.filter(resource => {
            const isBuiltIn = resource.group === 'system_resources' || builtInResourceNames.has(resource.name);
            if (!showBuiltIn && isBuiltIn) return false;
            if (statusFilter === 'running' && resource.status !== 'started') return false;
            if (statusFilter === 'stopped' && resource.status !== 'stopped') return false;
            if (!normalizedQuery) return true;
            return [resource.name, resource.group, resource.author, resource.description]
                .some(value => value.toLocaleLowerCase().includes(normalizedQuery));
        });
        const groups = new Map<string, ResourceEntry[]>();
        filtered.forEach(resource => {
            const existing = groups.get(resource.group) ?? [];
            existing.push(resource);
            groups.set(resource.group, existing);
        });
        return [...groups.entries()];
    }, [query, resources, showBuiltIn, statusFilter]);

    const toggleGroup = (group: string) => {
        setCollapsedGroups(current => {
            const next = new Set(current);
            next.has(group) ? next.delete(group) : next.add(group);
            try { window.localStorage.setItem('resourcesPageCollapsedGroups', JSON.stringify([...next])); } catch { /* noop */ }
            return next;
        });
    };

    const runResourceAction = async (resourceName: string, action: 'start_res' | 'restart_res' | 'stop_res') => {
        setBusyResource(resourceName);
        const actionCopy = action === 'start_res' ? t('Starting {resource}…', { resource: resourceName })
            : action === 'restart_res' ? t('Restarting {resource}…', { resource: resourceName })
            : t('Stopping {resource}…', { resource: resourceName });
        const toastId = txToast.loading(actionCopy);
        try {
            const response = await fetcher<ResourceActionResponse>('/fxserver/commands', {
                method: 'POST',
                body: { action, parameter: resourceName },
            });
            if (response.type === 'error') {
                txToast.error({ title: t('Resource action failed'), msg: t(response.msg) }, { id: toastId });
                return;
            }
            txToast.success(t(response.msg), { id: toastId });
            window.setTimeout(() => { void resourcesSWR.mutate(); }, 450);
        } catch (error) {
            txToast.error({
                title: t('Resource action failed'),
                msg: t(error instanceof Error ? error.message : 'Unknown error.'),
            }, { id: toastId });
        } finally {
            setBusyResource(undefined);
        }
    };

    const rescanResources = async () => {
        if (!canControl) return;
        setIsRescanning(true);
        const toastId = txToast.loading(t('Rescanning resources…'));
        try {
            const response = await fetcher<ResourceActionResponse>('/fxserver/commands', {
                method: 'POST',
                body: { action: 'refresh_res', parameter: '' },
            });
            if (response.type === 'error') {
                txToast.error({ title: t('Resource rescan failed'), msg: t(response.msg) }, { id: toastId });
                return;
            }
            txToast.success(t('Resource manifest refreshed.'), { id: toastId });
            window.setTimeout(() => { void resourcesSWR.mutate(); }, 450);
        } catch (error) {
            txToast.error({
                title: t('Resource rescan failed'),
                msg: t(error instanceof Error ? error.message : 'Unknown error.'),
            }, { id: toastId });
        } finally {
            setIsRescanning(false);
        }
    };

    const allCollapsed = groupedResources.length > 0 && groupedResources.every(([group]) => collapsedGroups.has(group));
    const toggleAllGroups = () => {
        const next = allCollapsed ? new Set<string>() : new Set(groupedResources.map(([group]) => group));
        setCollapsedGroups(next);
        try { window.localStorage.setItem('resourcesPageCollapsedGroups', JSON.stringify([...next])); } catch { /* noop */ }
    };

    return <div className="pb-8">
        <PageHeader title={t('Resources')} icon={<Wrench className="size-6" />}>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => void resourcesSWR.mutate()} disabled={resourcesSWR.isLoading || resourcesSWR.isValidating}>
                    <RefreshCw className={`mr-2 size-4 ${resourcesSWR.isValidating ? 'animate-spin' : ''}`} />{t('Refresh list')}
                </Button>
                <Button onClick={() => void rescanResources()} disabled={!canControl || isRescanning} title={!canControl ? t('You do not have permission to control resources.') : undefined}>
                    {isRescanning ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FolderSync className="mr-2 size-4" />}{t('Rescan')}
                </Button>
            </div>
        </PageHeader>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Stat label={t('Total resources')} value={resources.length} />
            <Stat label={t('Running')} value={runningCount} color="text-emerald-300" />
            <Stat label={t('Stopped')} value={stoppedCount} color="text-zinc-300" />
        </div>

        <Card className="mb-4">
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:items-center">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                    <Input value={query} onChange={event => setQuery(event.target.value)} className="pl-9" placeholder={t('Search name, folder, author, or description')} />
                </div>
                <div className="grid grid-cols-3 rounded-lg border border-white/5 bg-black/10 p-1">
                    {(['all', 'running', 'stopped'] as const).map(filter => <Button
                        key={filter}
                        size="sm"
                        variant={statusFilter === filter ? 'secondary' : 'ghost-muted'}
                        onClick={() => setStatusFilter(filter)}
                    >{filter === 'all' ? t('All') : filter === 'running' ? t('Running') : t('Stopped')}</Button>)}
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/10 px-3 py-2 text-sm text-zinc-300">
                    <span>{t('Show built-in')}</span>
                    <Switch checked={showBuiltIn} onCheckedChange={(checked) => {
                        setShowBuiltIn(checked);
                        try { window.localStorage.setItem('resourcesPageShowDefault', String(checked)); } catch { /* noop */ }
                    }} />
                </label>
            </CardContent>
        </Card>

        {resourcesSWR.data && <div className="mb-3 flex items-center justify-between px-1 text-xs text-zinc-600">
            <span>{t('{count} resources shown', { count: groupedResources.reduce((total, [, entries]) => total + entries.length, 0) })}</span>
            <div className="flex items-center gap-3">
                <span>{t('Updated {time}', { time: tsToLocaleDateTimeString(resourcesSWR.data.generatedAt, 'medium', 'short') })}</span>
                <button type="button" className="text-zinc-400 hover:text-white" onClick={toggleAllGroups}>{allCollapsed ? t('Expand all') : t('Collapse all')}</button>
            </div>
        </div>}

        {resourcesSWR.isLoading && !resourcesSWR.data && <Card><CardContent className="flex items-center justify-center gap-2 p-14 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />{t('Loading resources…')}</CardContent></Card>}
        {resourcesSWR.error && <Card className="border-red-500/20 bg-red-500/10"><CardContent className="p-6 text-sm text-red-300">
            {t(reportErrors[resourcesSWR.error.message as keyof typeof reportErrors] || 'The resources list could not be loaded.')}
        </CardContent></Card>}

        <div className="space-y-3">
            {groupedResources.map(([group, entries]) => {
                const collapsed = collapsedGroups.has(group);
                return <Card key={group} className="overflow-hidden">
                    <button type="button" className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/[0.025]" onClick={() => toggleGroup(group)} aria-expanded={!collapsed}>
                        <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-zinc-500"><Folder className="size-4" /></span>
                        <span className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-200">{group}</span>
                        <Badge variant="secondary" className="border-0 bg-white/5">{entries.length}</Badge>
                        {collapsed ? <ChevronDown className="size-4 text-zinc-500" /> : <ChevronUp className="size-4 text-zinc-500" />}
                    </button>
                    {!collapsed && <div className="divide-y divide-white/5">
                        {entries.map(resource => {
                            const running = resource.status === 'started';
                            const busy = busyResource === resource.name;
                            return <div key={resource.name} className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-white/[0.018] md:flex-row md:items-center">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-white">{resource.name}</p>
                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClasses(resource.status)}`}>{statusLabel(resource.status)}</span>
                                        {resource.version && <span className="font-mono text-[11px] text-zinc-600">{resource.version}</span>}
                                    </div>
                                    {(resource.author || resource.description) && <p className="mt-1 max-w-4xl truncate text-xs text-zinc-500">
                                        {resource.author && <span>{t('by {author}', { author: resource.author })}{resource.description ? ' · ' : ''}</span>}{resource.description}
                                    </p>}
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {running ? <>
                                        <Button size="sm" variant="outline-warning" disabled={!canControl || Boolean(busyResource)} onClick={() => void runResourceAction(resource.name, 'restart_res')}>
                                            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RotateCcw className="mr-2 size-4" />}{t('Restart')}
                                        </Button>
                                        <Button size="sm" variant="outline-destructive" disabled={!canControl || Boolean(busyResource)} onClick={() => void runResourceAction(resource.name, 'stop_res')}>
                                            <Square className="mr-2 size-3.5" />{t('Stop')}
                                        </Button>
                                    </> : <Button size="sm" variant="outline-success" disabled={!canControl || Boolean(busyResource)} onClick={() => void runResourceAction(resource.name, 'start_res')}>
                                        {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}{t('Start')}
                                    </Button>}
                                </div>
                            </div>;
                        })}
                    </div>}
                </Card>;
            })}
        </div>

        {resourcesSWR.data && !groupedResources.length && <Card><CardContent className="p-14 text-center text-sm text-zinc-500">{t('No resources match the current filters.')}</CardContent></Card>}
    </div>;
}
