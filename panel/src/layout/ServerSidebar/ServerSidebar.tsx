import { cn } from '@/lib/utils';
import { serverNameAtom } from '@/hooks/status';
import { useAtomValue } from 'jotai';
import { NavLink } from '@/components/MainPageLink';
import { UsersRound } from 'lucide-react';
import PanelBrand from '@/components/PanelBrand';
import ServerMenu from './ServerMenu';
import ServerControls from './ServerControls';
import { t } from '@/lib/i18n';

export function ServerSidebar({ isSheet }: { isSheet?: boolean }) {
    const serverName = useAtomValue(serverNameAtom);
    return <aside className={cn(
        'flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-[#1c1e23] text-white',
        isSheet ? 'w-full' : 'hidden lg:flex',
    )}>
        <div className="mt-8 flex items-center justify-center px-4">
            <NavLink href="/"><PanelBrand /></NavLink>
        </div>
        <form action="/administration/players" method="get" className="mt-7 px-2">
            <div className="relative">
                <input name="q" placeholder={t('Search players…')} className="w-full rounded-l-md rounded-r-2xl border border-white/5 bg-[#0f1116]/50 py-1.5 pl-3 pr-10 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-brand-600" />
                <button className="absolute right-3 top-2 text-zinc-500 transition-colors hover:text-white" aria-label={t('Search players…')}><UsersRound className="size-4" /></button>
            </div>
        </form>
        <div className="mt-4 grow px-2"><ServerMenu /></div>
        <div className="mx-3 mb-3 rounded-2xl border border-white/5 bg-white/5 p-3"><ServerControls /></div>
        <div className="border-t border-dashed border-white/5 px-4 py-3 text-xs text-neutral-500">
            <div className="truncate" title={serverName}>{serverName || t('Game server')}</div>
            <div className="mt-2 leading-5">Powered by cAdminPanel</div>
            <div className="mt-0.5 uppercase tracking-widest">PANEL V{window.txConsts.txaVersion} · FX B{window.txConsts.fxsVersion}</div>
        </div>
    </aside>;
}
