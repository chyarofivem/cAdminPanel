import { useEffect, useRef } from 'react';
import ThreadPerfCard from './ThreadPerfCard';
import PlayerDropCard from './PlayerDropCard';
import FullPerfCard from './FullPerfCard';
import { useSetDashboardData } from './dashboardHooks';
import { getSocket } from '@/lib/utils';
import ServerStatsCard from './ServerStatsCard';
import { useAtomValue } from 'jotai';
import { txConfigStateAtom } from '@/hooks/status';
import { useLocation } from 'wouter';
import { TxConfigState } from '@shared/enums';
import useSWR from 'swr';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAuth } from '@/hooks/auth';
import TxAnchor from '@/components/TxAnchor';
import { PageHeader } from '@/components/page-header';
import Section from '@/components/Section';
import { ListRow, ListRows } from '@/components/ListRow';
import EmptyState from '@/components/EmptyState';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cadminApiPath, cadminData, isCadminAvailable, toTxAdminLicense, type CadminResponse, type CadminPlayer } from '@/pages/CAdmin/api';
import { t } from '@/lib/i18n';

type CadminOverview = {
    status: { online: boolean; framework: string; version?: string; oxInventory?: boolean; schema?: string; error?: string };
    players: CadminPlayer[];
    recent: string[];
};

const safeText = (value: unknown, fallback = '') => (
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
);

//Header links keep a 44px touch target on phones.
const headerLinkClass = 'inline-flex min-h-11 shrink-0 items-center text-dense sm:min-h-0';

function CadminDashboard() {
    const fetcher = useAuthedFetcher();
    const overviewPath = cadminApiPath('overview');
    const cadminAvailable = isCadminAvailable();
    const swr = useSWR(cadminAvailable ? overviewPath : null, async () => cadminData(await fetcher<CadminResponse<CadminOverview>>(overviewPath)), { refreshInterval: 10_000 });
    if (!cadminAvailable) return null;
    const data = swr.data;
    const framework = safeText(data?.status.framework);
    const resourceVersion = safeText(data?.status.version);

    let statusBadge: React.ReactNode;
    if (!data && swr.isLoading) {
        statusBadge = <Badge>{t('Loading…')}</Badge>;
    } else if (data?.status.online) {
        statusBadge = <Badge variant="success">{t('Online')}</Badge>;
    } else {
        statusBadge = <Badge variant="danger">{t('Unreachable')}</Badge>;
    }

    return <>
        {safeText(data?.status.schema) && <Alert variant="warning">{safeText(data?.status.schema)}</Alert>}

        <Section title={t('Server')} actions={statusBadge}>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="min-w-0">
                    <p className="text-2xl font-semibold tabular-nums text-white">{data?.status.online ? data.players.length : '--'}</p>
                    <p className="text-dense text-muted-foreground">{t('players connected')}</p>
                </div>
                <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">{framework ? framework.toUpperCase() : t('unknown')}</p>
                    <p className="text-dense text-muted-foreground">{t('Framework')}</p>
                    {(data?.status.oxInventory || resourceVersion) && <div className="mt-2 flex flex-wrap items-center gap-2">
                        {data?.status.oxInventory && <Badge>ox_inventory</Badge>}
                        {resourceVersion && <span className="text-dense text-muted-foreground">{t('resource v{version}', { version: resourceVersion })}</span>}
                    </div>}
                </div>
            </div>
            {data?.status.error && <p className="mt-4 text-dense text-danger-text">{data.status.error}</p>}
        </Section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-white">{t('Online now')}</h2>
                    <TxAnchor className={headerLinkClass} href="/administration/players">{t('View all')}</TxAnchor>
                </div>
                {data?.players.length ? <ListRows>
                    {data.players.slice(0, 8).map(player => {
                        const license = toTxAdminLicense(player.playerLicense ?? player.identifier);
                        return <ListRow key={player.characterId ?? player.identifier} interactive={!!license} className="relative justify-between">
                            <div className="min-w-0">
                                {license ? (
                                    <TxAnchor
                                        className="block truncate text-sm font-medium text-white after:absolute after:inset-0 after:rounded-lg hover:text-white hover:no-underline"
                                        href={`/administration/players/${encodeURIComponent(license)}`}
                                    >
                                        {player.name}
                                    </TxAnchor>
                                ) : (
                                    <span className="block truncate text-sm font-medium text-white">{player.name}</span>
                                )}
                                <span className="block truncate text-dense tabular-nums text-muted-foreground">
                                    #{player.source}{license && player.job?.label ? ` · ${player.job.label}` : ''}
                                </span>
                            </div>
                            <span className="shrink-0 text-dense text-muted-foreground">{player.group || 'user'}</span>
                        </ListRow>;
                    })}
                </ListRows> : <EmptyState message={data?.status.online ? t('Nobody is connected.') : t('The game server is unreachable.')} />}
            </section>

            <section className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-white">{t('Recent administrator actions')}</h2>
                    <TxAnchor className={headerLinkClass} href="/system/panel-log">{t('View logs')}</TxAnchor>
                </div>
                {data?.recent.length ? <ListRows>
                    {data.recent.map((line, index) => <ListRow key={index}>
                        <span className="min-w-0 truncate font-mono text-xs text-body">{line}</span>
                    </ListRow>)}
                </ListRows> : <EmptyState message={t('Nothing recorded since the panel started.')} />}
            </section>
        </div>
    </>;
}


function DashboardPageInner() {
    const pageSocket = useRef<ReturnType<typeof getSocket> | null>(null);
    const setDashboardData = useSetDashboardData();
    const { authData } = useAuth();
    const displayName = (authData && authData.name) || 'admin';

    //Runing on mount only
    useEffect(() => {
        pageSocket.current = getSocket(['dashboard']);
        pageSocket.current.on('connect', () => {
            console.log("Dashboard Socket.IO Connected.");
        });
        pageSocket.current.on('disconnect', (message) => {
            console.log("Dashboard Socket.IO Disonnected:", message);
        });
        pageSocket.current.on('error', (error) => {
            console.log('Dashboard Socket.IO', error);
        });
        pageSocket.current.on('dashboard', function (data) {
            setDashboardData(data);
        });

        return () => {
            pageSocket.current?.removeAllListeners();
            pageSocket.current?.disconnect();
        }
    }, []);

    return (
        <div className="w-full min-w-0 pb-10">
            <PageHeader
                title={t('Welcome back, {name}.', { name: displayName })}
                subtitle={t('{name} at a glance.', { name: window.txConsts.panelName })}
            />
            <div className="flex flex-col gap-6">
                <CadminDashboard />
                <section className="flex flex-col gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-white">{t('Server performance')}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{t('Runtime health of the game server.')}</p>
                    </div>
                    <div className="flex flex-col gap-6">
                        <ServerStatsCard />
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <PlayerDropCard />
                            <ThreadPerfCard />
                        </div>
                        <FullPerfCard />
                    </div>
                </section>
            </div>
        </div>
    );
}


export default function DashboardPage() {
    const txConfigState = useAtomValue(txConfigStateAtom);
    const setLocation = useLocation()[1];

    //NOTE: redirects must happen in an effect, never during render
    useEffect(() => {
        if (txConfigState === TxConfigState.Setup) {
            setLocation('/server/setup');
        } else if (txConfigState === TxConfigState.Deployer) {
            setLocation('/server/deployer');
        }
    }, [txConfigState, setLocation]);

    if (txConfigState === TxConfigState.Setup || txConfigState === TxConfigState.Deployer) {
        return null;
    } else if (txConfigState !== TxConfigState.Ready) {
        return <div role="status" className="flex min-h-64 w-full items-center justify-center text-sm text-muted-foreground">
            {t('Checking server configuration...')}
        </div>;
    } else {
        return <DashboardPageInner />;
    }
}
