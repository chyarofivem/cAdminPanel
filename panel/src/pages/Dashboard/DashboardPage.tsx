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
import { ModalTabMessage } from '@/components/modal-tabs';
import GenericSpinner from '@/components/GenericSpinner';
import useSWR from 'swr';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAuth } from '@/hooks/auth';
import TxAnchor from '@/components/TxAnchor';
import { cadminApiPath, cadminData, toTxAdminLicense, type CadminResponse, type CadminPlayer } from '@/pages/CAdmin/api';
import { t } from '@/lib/i18n';

type CadminOverview = {
    status: { online: boolean; framework: string; version?: string; oxInventory?: boolean; schema?: string; error?: string };
    players: CadminPlayer[];
    identities: { accounts: number; fivemLinked: number; discordLinked: number; error?: string };
    recent: string[];
};

const safeText = (value: unknown, fallback = '') => (
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
);

function CadminDashboard() {
    const fetcher = useAuthedFetcher();
    const { authData } = useAuth();
    const overviewPath = cadminApiPath('overview');
    const swr = useSWR(window.txConsts.cadminEnabled ? overviewPath : null, async () => cadminData(await fetcher<CadminResponse<CadminOverview>>(overviewPath)), { refreshInterval: 10_000 });
    if (!window.txConsts.cadminEnabled) return null;
    const data = swr.data;
    const displayName = (authData && (authData.email || authData.name).split('@')[0]) || 'admin';
    return <>
        <div className="mt-6">
            <h1 className="text-2xl font-semibold">{t('Welcome back, {name}.', { name: displayName })}</h1>
            <p className="mt-1 text-sm text-zinc-400">{t('{name} at a glance.', { name: window.txConsts.panelName })}</p>
        </div>
        {safeText(data?.status.schema) && <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200">{safeText(data?.status.schema)}</div>}
        <div className={authData && authData.isMaster ? "mt-6 grid grid-cols-1 gap-4 md:grid-cols-3" : "mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"}>
            <div className="rounded-2xl bg-white/5 p-6">
                <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-widest text-neutral-500">{t('Server')}</p><span className={data?.status.online ? 'text-xs text-green-400' : 'text-xs text-red-400'}>● {data?.status.online ? t('Online') : t('Unreachable')}</span></div>
                <p className="mt-3 text-3xl font-semibold">{data?.status.online ? data.players.length : '—'}</p><p className="text-xs text-zinc-400">{t('players connected')}</p>
                {data?.status.error && <p className="mt-3 text-xs text-red-300">{data.status.error}</p>}
            </div>
            <div className="rounded-2xl bg-white/5 p-6"><p className="text-xs uppercase tracking-widest text-neutral-500">{t('Framework')}</p><p className="mt-3 text-3xl font-semibold uppercase">{safeText(data?.status.framework, t('unknown'))}</p><div className="mt-2 flex gap-2 text-xs">{data?.status.oxInventory && <span className="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-green-400">ox_inventory</span>}{safeText(data?.status.version) && <span className="rounded-md bg-white/5 px-2 py-0.5 text-zinc-400">{t('resource v{version}', { version: safeText(data?.status.version) })}</span>}</div></div>
            {authData && authData.isMaster && <div className="rounded-2xl bg-white/5 p-6"><p className="text-xs uppercase tracking-widest text-neutral-500">{t('Identity links')}</p><p className="mt-3 text-3xl font-semibold">{data?.identities.fivemLinked ?? '—'}</p><p className="text-xs text-zinc-400">{t('FiveM accounts linked')}</p><p className="mt-2 text-xs text-zinc-500">{data ? t('{discord} Discord · {accounts} chyarologin accounts', { discord: data.identities.discordLinked, accounts: data.identities.accounts }) : t('Loading identities…')}</p>{data?.identities.error && <p className="mt-2 text-xs text-red-300">{data.identities.error}</p>}</div>}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl bg-white/5"><div className="flex items-center justify-between border-b border-dashed border-white/5 px-6 py-4"><h2 className="font-medium">{t('Online now')}</h2><TxAnchor className="text-xs" href="/administration/players">{t('View all')}</TxAnchor></div>{data?.players.length ? <ul className="divide-y divide-dashed divide-white/5">{data.players.slice(0, 8).map(player => {
                const license = toTxAdminLicense(player.playerLicense ?? player.identifier);
                return <li key={player.characterId ?? player.identifier} className="flex items-center justify-between px-6 py-3 transition hover:bg-white/5">{license ? <TxAnchor className="text-white hover:no-underline" href={`/administration/players/${encodeURIComponent(license)}`}><span className="block text-sm font-medium">{player.name}</span><span className="text-xs text-zinc-500">#{player.source}{player.job?.label ? ` · ${player.job.label}` : ''}</span></TxAnchor> : <span className="text-white"><span className="block text-sm font-medium">{player.name}</span><span className="text-xs text-zinc-500">#{player.source}</span></span>}<span className="text-xs uppercase tracking-widest text-zinc-500">{player.group || 'user'}</span></li>;
            })}</ul> : <p className="px-6 py-8 text-center text-sm text-zinc-500">{data?.status.online ? t('Nobody is connected.') : t('The game server is unreachable.')}</p>}</div>
            <div className="overflow-hidden rounded-2xl bg-white/5"><div className="flex items-center justify-between border-b border-dashed border-white/5 px-6 py-4"><h2 className="font-medium">{t('Recent administrator actions')}</h2><TxAnchor className="text-xs" href="/system/txadmin-log">{t('View logs')}</TxAnchor></div>{data?.recent.length ? <ul className="divide-y divide-dashed divide-white/5">{data.recent.map((line, index) => <li key={index} className="truncate px-6 py-3 font-mono text-xs text-zinc-400">{line}</li>)}</ul> : <p className="px-6 py-8 text-center text-sm text-zinc-500">{t('Nothing recorded since the panel started.')}</p>}</div>
        </div>
    </>;
}


function DashboardPageInner() {
    const pageSocket = useRef<ReturnType<typeof getSocket> | null>(null);
    const setDashboardData = useSetDashboardData();

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
        <div className="w-full min-w-96 flex flex-col gap-4 pb-10">
            <CadminDashboard />
            <div className="mt-6 border-t border-dashed border-white/5 pt-6">
                <h2 className="text-lg font-semibold">{t('Server performance')}</h2>
                <p className="mt-1 text-sm text-zinc-400">{t('Runtime health of the game server.')}</p>
            </div>
            <div className="w-full grid grid-cols-1 md:grid-cols-3 3xl:grid-cols-8 gap-4">
                <PlayerDropCard />
                <ServerStatsCard />
                <ThreadPerfCard />
            </div>
            <FullPerfCard />
        </div>
    );
}


export default function DashboardPage() {
    const txConfigState = useAtomValue(txConfigStateAtom);
    const setLocation = useLocation()[1];

    if (txConfigState === TxConfigState.Setup) {
        setLocation('/server/setup');
        return null;
    } else if (txConfigState === TxConfigState.Deployer) {
        setLocation('/server/deployer');
        return null;
    } else if (txConfigState !== TxConfigState.Ready) {
        return <div className='size-full'>
            <ModalTabMessage>
                <GenericSpinner msg={`Unknown Config State: ${String(txConfigState)}`} />
            </ModalTabMessage>
        </div>;
    } else {
        return <DashboardPageInner />;
    }
}
