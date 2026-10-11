import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { RefreshCwIcon } from 'lucide-react';
import type {
    ResourceBackupInfo,
    ResourceInfo,
    ResourceReportError,
    ResourcesDataResp,
    ResourceUpdateApplyResp,
    ResourceUpdatesCheckResp,
} from '@shared/resourceManagerTypes';
import { PageHeader } from '@/components/page-header';
import { ListRow, ListRows } from '@/components/ListRow';
import EmptyState from '@/components/EmptyState';
import { txToast } from '@/components/TxToaster';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPerms } from '@/hooks/auth';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { useAuthedFetcher } from '@/hooks/fetch';
import { tsToLocaleDateTimeString } from '@/lib/dateTime';
import { t } from '@/lib/i18n';
import ResourceDetails from './ResourceDetails';
import StartOrder from './StartOrder';
import { checkFailureCopy, reportErrorCopy, updateFailureCopy } from './resourceCopy';

type ResourcesData = Extract<ResourcesDataResp, { success: true }>['data'];

type ResourceActionResponse = {
    type: 'default' | 'loading' | 'info' | 'success' | 'warning' | 'error';
    msg: string;
};

type StatusFilter = 'all' | 'running' | 'stopped';
type PageView = 'resources' | 'start-order';

const builtInResourceNames = new Set([
    'baseevents', 'basic-gamemode', 'betaguns', 'channelfeed', 'chat-theme-gtao', 'chat',
    'example-loadscreen', 'fivem-awesome1501', 'fivem-map-hipster', 'fivem-map-skater',
    'fivem', 'gameInit', 'hardcap', 'irc', 'keks', 'mapmanager', 'money-fountain-example-map',
    'money-fountain', 'money', 'monitor', 'obituary-deaths', 'obituary', 'ped-money-drops',
    'player-data', 'playernames', 'race-test', 'race', 'rconlog', 'redm-map-one', 'runcode',
    'scoreboard', 'sessionmanager-rdr3', 'sessionmanager', 'spawnmanager', 'webadmin', 'webpack', 'yarn',
]);

const statusLabel = (status: string) => {
    if (status === 'started') return t('Running');
    if (status === 'stopped') return t('Stopped');
    if (status === 'starting') return t('Starting');
    return t('Unknown');
};

const statusVariant = (status: string): BadgeProps['variant'] => {
    if (status === 'started') return 'success';
    if (status === 'starting') return 'warning';
    return 'default';
};

const detailsId = (name: string) => `resource-details-${name.replace(/[^A-Za-z0-9_-]/g, '_')}`;

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

//A filter tab with its live count, so the counts double as the page summary.
function FilterTab({ value, label, count }: { value: StatusFilter; label: string; count: number }) {
    return <TabsTrigger value={value} className="gap-2">
        {label}
        <span className="tabular-nums text-muted-foreground">{count.toLocaleString(window.txBrowserLocale)}</span>
    </TabsTrigger>;
}

export default function ResourcesPage() {
    const fetcher = useAuthedFetcher();
    const openConfirmDialog = useOpenConfirmDialog();
    const { hasPerm, isMaster } = useAdminPerms();
    const canControl = hasPerm('commands.resources');
    const [view, setView] = useState<PageView>('resources');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [showBuiltIn, setShowBuiltIn] = useState(() => readStoredBoolean('resourcesPageShowDefault', false));
    const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);
    const [expandedResources, setExpandedResources] = useState<Set<string>>(() => new Set());
    const [busyResource, setBusyResource] = useState<string>();
    const [replacingResource, setReplacingResource] = useState<string>();
    const [isRescanning, setIsRescanning] = useState(false);
    const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

    const resourcesSWR = useSWR('/resources/data', async (url) => {
        const response = await fetcher<ResourcesDataResp>(url);
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
        const groups = new Map<string, ResourceInfo[]>();
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

    const toggleDetails = (name: string) => {
        setExpandedResources(current => {
            const next = new Set(current);
            next.has(name) ? next.delete(name) : next.add(name);
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

    const checkForUpdates = async () => {
        if (!canControl) return;
        setIsCheckingUpdates(true);
        const toastId = txToast.loading(t('Checking GitHub releases…'));
        try {
            const response = await fetcher<ResourceUpdatesCheckResp>('/resources/updates/check', {
                method: 'POST',
                body: {},
            });
            if (!response.success) {
                txToast.error({ title: t('Update check failed'), msg: t(checkFailureCopy[response.error]) }, { id: toastId });
                return;
            }
            void resourcesSWR.mutate((current) => current && {
                ...current,
                resources: current.resources.map(resource => response.results[resource.name]
                    ? { ...resource, update: response.results[resource.name] }
                    : resource),
            }, { revalidate: false });

            const results = Object.values(response.results);
            if (!results.length) {
                txToast.info(t('No resource links a GitHub repository.'), { id: toastId });
                return;
            }
            const updates = results.filter(result => result.hasUpdate).length;
            const failed = results.filter(result => result.error && result.error !== 'unknown_version').length;
            const summary = [
                updates ? t('Updates available: {count}.', { count: updates }) : t('No updates available.'),
                failed ? t('{count} could not be checked.', { count: failed }) : '',
            ].filter(Boolean).join(' ');
            if (failed && !updates) {
                txToast.warning(summary, { id: toastId });
            } else {
                txToast.success(summary, { id: toastId });
            }
        } catch (error) {
            txToast.error({
                title: t('Update check failed'),
                msg: t(error instanceof Error ? error.message : 'Unknown error.'),
            }, { id: toastId });
        } finally {
            setIsCheckingUpdates(false);
        }
    };

    const replaceResource = async (resource: ResourceInfo, backup?: ResourceBackupInfo) => {
        const isRollback = Boolean(backup);
        setReplacingResource(resource.name);
        const toastId = txToast.loading(isRollback
            ? t('Rolling back {resource}…', { resource: resource.name })
            : t('Updating {resource}…', { resource: resource.name }));
        try {
            const response = await fetcher<ResourceUpdateApplyResp>(`/resources/updates/${isRollback ? 'rollback' : 'apply'}`, {
                method: 'POST',
                body: backup ? { resource: resource.name, backupId: backup.id } : { resource: resource.name },
            });
            if (!response.success) {
                txToast.error({
                    title: isRollback ? t('Rollback failed') : t('Update failed'),
                    msg: t(updateFailureCopy[response.error] ?? 'Unknown error.'),
                }, { id: toastId });
                return;
            }
            const done = isRollback
                ? t('{resource} rolled back to {version}.', { resource: response.resource, version: response.version })
                : t('{resource} updated to {version}.', { resource: response.resource, version: response.version });
            txToast.success({
                title: done,
                msg: response.pendingRestart
                    ? t('Restart it to load the new files.')
                    : t('The new files load the next time it starts.'),
            }, { id: toastId });
            window.setTimeout(() => { void resourcesSWR.mutate(); }, 1000);
        } catch (error) {
            txToast.error({
                title: isRollback ? t('Rollback failed') : t('Update failed'),
                msg: t(error instanceof Error ? error.message : 'Unknown error.'),
            }, { id: toastId });
        } finally {
            setReplacingResource(undefined);
        }
    };

    const confirmUpdate = (resource: ResourceInfo) => {
        const version = resource.update?.latest ?? '';
        openConfirmDialog({
            title: t('Update {resource} to {version}?', { resource: resource.name, version }),
            message: t('Every file in the resource folder is replaced with the release, including files you edited there, such as configs. A backup of the current files is kept and can be restored with Roll back. The resource is not restarted.'),
            actionLabel: t('Update'),
            confirmBtnVariant: 'destructive',
            onConfirm: () => void replaceResource(resource),
        });
    };

    const confirmRollback = (resource: ResourceInfo, backup: ResourceBackupInfo) => {
        openConfirmDialog({
            title: t('Roll back {resource} to {version}?', { resource: resource.name, version: backup.version }),
            message: t('Every file in the resource folder is replaced with the backup from {date}. A backup of the current files is kept first. The resource is not restarted.', {
                date: tsToLocaleDateTimeString(backup.createdAt, 'medium', 'short'),
            }),
            actionLabel: t('Roll back'),
            confirmBtnVariant: 'destructive',
            onConfirm: () => void replaceResource(resource, backup),
        });
    };

    const allCollapsed = groupedResources.length > 0 && groupedResources.every(([group]) => collapsedGroups.has(group));
    const toggleAllGroups = () => {
        const next = allCollapsed ? new Set<string>() : new Set(groupedResources.map(([group]) => group));
        setCollapsedGroups(next);
        try { window.localStorage.setItem('resourcesPageCollapsedGroups', JSON.stringify([...next])); } catch { /* noop */ }
    };

    const reportError = resourcesSWR.error?.message as ResourceReportError | undefined;
    const errorAlert = resourcesSWR.error && <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{t(reportErrorCopy[reportError as ResourceReportError] || 'The resources list could not be loaded.')}</span>
            {reportError !== 'server_offline' && <Button variant="link" className="text-sm" onClick={() => void resourcesSWR.mutate()}>
                {t('Try again')}
            </Button>}
        </AlertDescription>
    </Alert>;
    const loadingState = resourcesSWR.isLoading && !resourcesSWR.data && <p role="status" className="text-sm text-muted-foreground">
        {t('Loading resources…')}
    </p>;

    const shownCount = groupedResources.reduce((total, [, entries]) => total + entries.length, 0);
    const data: ResourcesData | undefined = resourcesSWR.data;
    return <div className="pb-8">
        <PageHeader title={t('Resources')}>
            <IconButton
                label={t('Refresh list')}
                icon={<RefreshCwIcon />}
                className="size-11 sm:size-9"
                onClick={() => void resourcesSWR.mutate()}
                disabled={resourcesSWR.isLoading || resourcesSWR.isValidating}
            />
            <Button
                variant="secondary"
                onClick={() => void checkForUpdates()}
                disabled={!canControl || !data || isCheckingUpdates}
                title={!canControl ? t('You do not have permission to control resources.') : undefined}
            >
                {isCheckingUpdates ? t('Checking…') : t('Check for updates')}
            </Button>
            <Button onClick={() => void rescanResources()} disabled={!canControl || isRescanning} title={!canControl ? t('You do not have permission to control resources.') : undefined}>
                {t('Rescan')}
            </Button>
        </PageHeader>

        <Tabs value={view} onValueChange={value => setView(value as PageView)} className="flex flex-col gap-6">
            <TabsList className="w-full sm:w-auto sm:self-start">
                <TabsTrigger value="resources">{t('Resources')}</TabsTrigger>
                <TabsTrigger value="start-order">{t('Start order')}</TabsTrigger>
            </TabsList>

            {!canControl && <Alert variant="info">
                <AlertDescription>{t('You can view resources, but your account cannot start, stop, or update them.')}</AlertDescription>
            </Alert>}

            <TabsContent value="resources" className="mt-0 flex flex-col gap-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <Input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        className="text-dense sm:h-9 lg:max-w-sm"
                        aria-label={t('Search name, folder, author, or description')}
                        placeholder={t('Search name, folder, author, or description')}
                    />
                    <Tabs value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)} className="min-w-0 max-w-full">
                        <TabsList className="max-w-full">
                            <FilterTab value="all" label={t('All')} count={resources.length} />
                            <FilterTab value="running" label={t('Running')} count={runningCount} />
                            <FilterTab value="stopped" label={t('Stopped')} count={stoppedCount} />
                        </TabsList>
                    </Tabs>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-body lg:ml-auto">
                        <Switch checked={showBuiltIn} onCheckedChange={(checked) => {
                            setShowBuiltIn(checked);
                            try { window.localStorage.setItem('resourcesPageShowDefault', String(checked)); } catch { /* noop */ }
                        }} />
                        <span>{t('Show built-in')}</span>
                    </label>
                </div>

                {loadingState}
                {errorAlert}

                {data && <div className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="tabular-nums">{t('{count} resources shown', { count: shownCount })}</span>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="tabular-nums">{t('Updated {time}', { time: tsToLocaleDateTimeString(data.generatedAt, 'medium', 'short') })}</span>
                            {groupedResources.length > 0 && <Button variant="link" className="text-xs" onClick={toggleAllGroups}>
                                {allCollapsed ? t('Expand all') : t('Collapse all')}
                            </Button>}
                        </div>
                    </div>

                    {groupedResources.map(([group, entries]) => {
                        const collapsed = collapsedGroups.has(group);
                        return <section key={group} className="flex flex-col gap-2">
                            <button
                                type="button"
                                className="flex min-h-11 w-full items-center gap-3 rounded-sm text-left transition-colors duration-150 hover:text-white"
                                onClick={() => toggleGroup(group)}
                                aria-expanded={!collapsed}
                            >
                                <span className="min-w-0 truncate font-mono text-dense font-medium text-white">{group}</span>
                                <span className="text-xs tabular-nums text-muted-foreground">{entries.length}</span>
                                <span className="ml-auto text-dense text-muted-foreground">{collapsed ? t('Show') : t('Hide')}</span>
                            </button>
                            {!collapsed && <ListRows>
                                {entries.map(resource => {
                                    const running = resource.status === 'started';
                                    const actionsDisabled = !canControl || Boolean(busyResource) || replacingResource === resource.name;
                                    const expanded = expandedResources.has(resource.name);
                                    const hasMissingDependency = resource.dependencies.some(dependency => dependency.missing);
                                    return <ListRow key={resource.name} className="flex-col items-stretch">
                                        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="break-all font-medium text-white">{resource.name}</p>
                                                    <Badge variant={statusVariant(resource.status)}>{statusLabel(resource.status)}</Badge>
                                                    {resource.version && <span className="font-mono text-xs text-muted-foreground">{resource.version}</span>}
                                                    {resource.pendingRestart && <Badge variant="warning">{t('Restart to apply')}</Badge>}
                                                    {resource.update?.hasUpdate && !resource.pendingRestart && <Badge variant="info">
                                                        {t('Update available: {version}', { version: resource.update.latest ?? '' })}
                                                    </Badge>}
                                                    {hasMissingDependency && <Badge variant="danger">{t('Missing dependency')}</Badge>}
                                                </div>
                                                {(resource.author || resource.description) && <p className="mt-1 truncate text-dense text-muted-foreground">
                                                    {resource.author && <span>{t('by {author}', { author: resource.author })}{resource.description ? ' · ' : ''}</span>}{resource.description}
                                                </p>}
                                            </div>
                                            <div className="flex shrink-0 flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    aria-expanded={expanded}
                                                    aria-controls={expanded ? detailsId(resource.name) : undefined}
                                                    onClick={() => toggleDetails(resource.name)}
                                                >
                                                    {expanded ? t('Hide details') : t('Details')}
                                                </Button>
                                                {running ? <>
                                                    <Button size="sm" variant="secondary" disabled={actionsDisabled} onClick={() => void runResourceAction(resource.name, 'restart_res')}>
                                                        {t('Restart')}
                                                    </Button>
                                                    <Button size="sm" variant="outline-destructive" disabled={actionsDisabled} onClick={() => void runResourceAction(resource.name, 'stop_res')}>
                                                        {t('Stop')}
                                                    </Button>
                                                </> : <Button size="sm" variant="secondary" disabled={actionsDisabled} onClick={() => void runResourceAction(resource.name, 'start_res')}>
                                                    {t('Start')}
                                                </Button>}
                                            </div>
                                        </div>
                                        {expanded && <ResourceDetails
                                            id={detailsId(resource.name)}
                                            resource={resource}
                                            isMaster={isMaster}
                                            isBusy={Boolean(replacingResource)}
                                            onUpdate={confirmUpdate}
                                            onRollback={confirmRollback}
                                        />}
                                    </ListRow>;
                                })}
                            </ListRows>}
                        </section>;
                    })}

                    {!groupedResources.length && <EmptyState message={t('No resources match the current filters.')} />}
                </div>}
            </TabsContent>

            <TabsContent value="start-order" className="mt-0 flex flex-col gap-6">
                {loadingState}
                {errorAlert}
                {data && <StartOrder bootOrder={data.bootOrder} />}
            </TabsContent>
        </Tabs>
    </div>;
}
