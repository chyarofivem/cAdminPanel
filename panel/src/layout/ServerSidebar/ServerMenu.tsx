import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAtomValue } from 'jotai';
import {
    Activity, ChevronDown, ClipboardCheck, Ellipsis, FileEdit, FlaskConical, Gauge, History, LayoutDashboard,
    Package, ScrollText, Settings, TerminalSquare, UserRoundCog, Users, Wrench, Zap, type LucideIcon,
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
    icon: LucideIcon;
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

const isLinkActive = (location: string, href: string) => (
    href === '/' ? location === '/' : location === href || location.startsWith(`${href}/`)
);

/**
 * Nav row: 44px, 8px x 14px, radius-md, body text with a 16px icon before the label.
 * Hover is raise with white text, active is accent-soft with the accent text colour;
 * the icon is muted at rest and follows the label on hover and when active.
 * NOTE: the design system bans icons beside nav labels; the sidebar keeps them at the
 * user's request (2026-10).
 */
const navRowClass = 'group flex min-h-11 w-full items-center gap-3 rounded-md px-3.5 py-2 text-sm text-body transition-colors duration-150 hover:bg-raise hover:text-white';
const navRowActiveClass = 'bg-accent-soft text-accent-text hover:bg-accent-soft hover:text-accent-text';
const navIconClass = 'size-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-white';
const navIconActiveClass = 'text-accent-text group-hover:text-accent-text';

function SidebarLink({ link }: { link: LinkSpec }) {
    const [location] = useLocation();
    const isVisible = useLinkVisibilityFilter();
    const active = isLinkActive(location, link.href);
    if (!isVisible(link)) return null;
    const Icon = link.icon;
    return <MainPageLink
        href={link.href}
        isActive={active}
        aria-current={active ? 'page' : undefined}
        className={cn(navRowClass, active && navRowActiveClass)}
    >
        <Icon aria-hidden="true" className={cn(navIconClass, active && navIconActiveClass)} />
        <span className="min-w-0 truncate">{link.label}</span>
    </MainPageLink>;
}

/**
 * The collapsed group for pages used rarely. It opens itself while one of its
 * pages is active, and keeps its links mounted while collapsed.
 */
function NavGroup({ label, links }: { label: string; links: LinkSpec[] }) {
    const [location] = useLocation();
    const isVisible = useLinkVisibilityFilter();
    const visible = links.filter(isVisible);
    const groupActive = visible.some(link => isLinkActive(location, link.href));
    const [open, setOpen] = useState(groupActive);
    const contentRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (groupActive) setOpen(true);
    }, [groupActive]);
    useEffect(() => {
        if (contentRef.current) contentRef.current.inert = !open;
    }, [open]);
    if (!visible.length) return null;
    return <div>
        <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(value => !value)}
            className={cn(navRowClass, 'text-muted-foreground')}
        >
            <Ellipsis aria-hidden="true" className={navIconClass} />
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 transition-transform duration-150', open && 'rotate-180')} />
        </button>
        <div
            ref={contentRef}
            aria-hidden={!open}
            className={cn(
                'grid transition-[grid-template-rows,opacity] duration-150 motion-reduce:transition-none',
                open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0',
            )}
        >
            <div className="overflow-hidden">
                <div className="flex flex-col gap-1 pt-1">
                    {visible.map(link => <SidebarLink key={link.href} link={link} />)}
                </div>
            </div>
        </div>
    </div>;
}

export default function ServerMenu() {
    //Everyday pages on top, rarely used ones in the collapsed group.
    const everyday: LinkSpec[] = [
        { label: t('Home'), href: '/', icon: LayoutDashboard },
        { label: t('Players'), href: '/administration/players', icon: UserRoundCog, requires: 'configured' },
        { label: t('Console'), href: '/server/console-log', icon: TerminalSquare, permission: 'console.view', requires: 'configured' },
        { label: t('Resources'), href: '/server/resources', icon: Wrench, requires: 'online' },
        { label: t('Resource monitor'), href: '/server/resource-monitor', icon: Gauge, requires: 'configured' },
        { label: t('History'), href: '/administration/history', icon: History, requires: 'configured' },
        { label: t('Allowlist'), href: '/server/allowlist', icon: ClipboardCheck, requires: 'configured' },
        { label: t('Settings'), href: '/settings', icon: Settings, permission: 'settings.view' },
    ];
    const more: LinkSpec[] = [
        { label: t('Staff & Permissions'), href: '/admins', icon: Users, permission: 'manage.admins' },
        { label: t('Player Drops'), href: '/insights/player-drops', icon: Activity, requires: 'configured' },
        { label: t('CFG Editor'), href: '/system/cfg-editor', icon: FileEdit, master: true, requires: 'configured' },
        { label: t('FXServer builds'), href: '/system/fxserver-builds', icon: Package, master: true, requires: 'configured' },
        { label: t('Master Actions'), href: '/system/master-actions', icon: Zap, master: true },
        { label: t('Panel Log'), href: '/system/panel-log', icon: ScrollText, permission: 'panel.log.view' },
    ];
    if (window.txConsts.showAdvanced) {
        more.push({ label: t('Advanced'), href: '/advanced', icon: FlaskConical, permission: 'all_permissions' });
    }

    return <nav aria-label={t('Main')} className="flex flex-col gap-1">
        {everyday.map(link => <SidebarLink key={link.href} link={link} />)}
        <NavGroup label={t('More')} links={more} />
    </nav>;
}
