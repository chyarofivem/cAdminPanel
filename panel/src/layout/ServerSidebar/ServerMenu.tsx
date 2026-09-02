import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAtomValue } from 'jotai';
import {
    Activity, ChevronDown, CircleGauge, ClipboardCheck, FileEdit,
    History, LayoutDashboard, ScrollText, Server, Settings, ShieldCheck,
    TerminalSquare, UserRoundCog, Users, Wrench, Zap,
} from 'lucide-react';
import { TxConfigState } from '@shared/enums';
import MainPageLink from '@/components/MainPageLink';
import { useAdminPerms } from '@/hooks/auth';
import { fxRunnerStateAtom, txConfigStateAtom } from '@/hooks/status';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

type LinkSpec = {
    label: string;
    href: string;
    icon?: React.ReactNode;
    permission?: string;
    master?: boolean;
    /**
     * Hides the link until the server reaches a given state:
     * - `configured`: the pages behind it need a deployed/configured server to have any data.
     * - `online`: the pages behind it only work while the fxserver process is alive.
     */
    requires?: 'configured' | 'online';
};

/**
 * Returns a predicate that filters out links the current admin cannot use, either
 * because of their permissions or because the server is not configured/online yet.
 * The page the admin is currently on is never state-gated, so they don't end up
 * browsing a page that has no entry in the sidebar.
 */
function useLinkVisibilityFilter() {
    const [location] = useLocation();
    const { hasPerm } = useAdminPerms();
    const txConfigState = useAtomValue(txConfigStateAtom);
    const fxRunnerState = useAtomValue(fxRunnerStateAtom);
    const isConfigured = txConfigState === TxConfigState.Ready;
    const isOnline = isConfigured && fxRunnerState.isChildAlive;
    return useMemo(() => (link: LinkSpec) => {
        if (link.master ? !hasPerm('master') : link.permission && !hasPerm(link.permission)) return false;
        if (!link.requires) return true;
        if (location === link.href || location.startsWith(`${link.href}/`)) return true;
        return link.requires === 'online' ? isOnline : isConfigured;
    }, [hasPerm, isConfigured, isOnline, location]);
}

function SidebarLink({ link, nested = false }: { link: LinkSpec; nested?: boolean }) {
    const [location] = useLocation();
    const isVisible = useLinkVisibilityFilter();
    const active = link.href === '/' ? location === '/' : location === link.href || location.startsWith(`${link.href}/`);
    if (!isVisible(link)) return null;
    return <MainPageLink href={link.href} isActive={active} className={cn(
        'flex items-center rounded-lg text-sm transition-colors duration-200',
        nested ? 'mx-2 px-3 py-1.5 text-zinc-400 hover:bg-white/5 hover:text-white' : 'px-3 py-2 text-gray-300 hover:bg-white/5 hover:text-white',
        active && (nested ? 'bg-white/5 text-white shadow-sm' : 'border-2 border-dashed border-brand-600/20 bg-brand-600/10 text-brand-500 shadow-sm'),
    )}>
        {link.icon && <span className={cn('mr-2 text-zinc-500', active && 'text-brand-500/60')}>{link.icon}</span>}
        {link.label}
    </MainPageLink>;
}

function NavGroup({ label, icon, links }: { label: string; icon: React.ReactNode; links: LinkSpec[] }) {
    const [location] = useLocation();
    const isVisible = useLinkVisibilityFilter();
    const visible = links.filter(isVisible);
    const groupActive = visible.some(link => location === link.href || location.startsWith(`${link.href}/`));
    const [open, setOpen] = useState(groupActive);
    const contentRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (groupActive) setOpen(true);
    }, [groupActive]);
    useEffect(() => {
        if (contentRef.current) contentRef.current.inert = !open;
    }, [open]);
    if (!visible.length) return null;
    return <div className="mt-1">
        <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white',
            groupActive && 'border-2 border-dashed border-brand-600/20 bg-brand-600/10 text-brand-500',
        )}>
            <span className="flex items-center"><span className={cn('mr-2 text-zinc-500', groupActive && 'text-brand-500/60')}>{icon}</span>{label}</span>
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
        <div ref={contentRef} aria-hidden={!open} className={cn('grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none', open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0')}>
            <div className="overflow-hidden"><div className="mt-1 space-y-1">{visible.map(link => <SidebarLink key={link.href} link={link} nested />)}</div></div>
        </div>
    </div>;
}

const iconClass = 'size-5';

export default function ServerMenu() {
    return <nav className="font-medium">
        <SidebarLink link={{ label: t('Home'), href: '/', icon: <LayoutDashboard className={iconClass} /> }} />
        <NavGroup label={t('Administration')} icon={<ShieldCheck className={iconClass} />} links={[
            { label: t('Player Management'), href: '/administration/players', icon: <UserRoundCog className="size-4" />, requires: 'configured' },
            { label: t('History'), href: '/administration/history', icon: <History className="size-4" />, requires: 'configured' },
            { label: t('Staff & Permissions'), href: '/admins', icon: <Users className="size-4" />, permission: 'manage.admins' },
        ]} />
        <NavGroup label={t('Server')} icon={<Server className={iconClass} />} links={[
            { label: t('Console Log'), href: '/server/console-log', icon: <TerminalSquare className="size-4" />, permission: 'console.view', requires: 'configured' },
            { label: t('Resources'), href: '/server/resources', icon: <Wrench className="size-4" />, requires: 'online' },
            { label: t('Allowlist'), href: '/server/allowlist', icon: <ClipboardCheck className="size-4" />, requires: 'configured' },
            { label: t('Player Drops'), href: '/insights/player-drops', icon: <Activity className="size-4" />, requires: 'configured' },
        ]} />
        <NavGroup label={t('System')} icon={<CircleGauge className={iconClass} />} links={[
            { label: t('CFG Editor'), href: '/system/cfg-editor', icon: <FileEdit className="size-4" />, master: true, requires: 'configured' },
            { label: t('Settings'), href: '/settings', icon: <Settings className="size-4" />, permission: 'settings.view' },
            { label: t('Master Actions'), href: '/system/master-actions', icon: <Zap className="size-4" />, master: true },
            { label: t('Panel Log'), href: '/system/panel-log', icon: <ScrollText className="size-4" />, permission: 'panel.log.view' },
        ]} />
        {window.txConsts.showAdvanced && <SidebarLink link={{ label: t('Advanced'), href: '/advanced', icon: <Zap className={iconClass} />, permission: 'all_permissions' }} />}
    </nav>;
}
