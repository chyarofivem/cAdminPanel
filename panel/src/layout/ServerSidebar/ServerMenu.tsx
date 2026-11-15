import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useAtomValue } from 'jotai';
import {
    Activity, ChevronDown, ClipboardCheck, FileEdit, FlaskConical, Gauge, History, LayoutDashboard,
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


//MARK: Sliding pill
/**
 * The sidebar's rows stay transparent. One shared pill (raise fill, 1px hairline
 * border, radius-md) slides between them over 220ms, following the hovered or
 * focused row and returning to the active row when the pointer leaves. Only the row
 * under the pill reads bright: the active row has the accent text label and the
 * accent icon while the pill rests on it, and dims to body text with a faint icon
 * while another row is hovered.
 */
const PillContext = createContext<string | null>(null);
const GROUP_KEY = 'group:more';

type RowState = 'idle' | 'pill' | 'active-pill';
function useRowState(rowKey: string, active: boolean): RowState {
    const pillKey = useContext(PillContext);
    if (pillKey !== rowKey) return 'idle';
    return active ? 'active-pill' : 'pill';
}

/**
 * Nav row: 44px, 8px x 14px, radius-md, a 24px icon, a 10px gap, then the 14px/500 label.
 */
const navRowClass = 'relative z-10 flex min-h-11 w-full items-center gap-2.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors duration-150 text-body group-data-[nav-state=pill]:text-white group-data-[nav-state=active-pill]:text-accent-text';
const navIconClass = 'size-6 shrink-0 transition-colors duration-150 text-faint group-data-[nav-state=pill]:text-body group-data-[nav-state=active-pill]:text-accent-icon';

function SidebarLink({ link }: { link: LinkSpec }) {
    const [location] = useLocation();
    const isVisible = useLinkVisibilityFilter();
    const active = isLinkActive(location, link.href);
    const state = useRowState(link.href, active);
    if (!isVisible(link)) return null;
    const Icon = link.icon;
    return <div data-nav-key={link.href} data-nav-state={state} className="group">
        <MainPageLink
            href={link.href}
            isActive={active}
            aria-current={active ? 'page' : undefined}
            className={navRowClass}
        >
            <Icon aria-hidden="true" className={navIconClass} />
            <span className="min-w-0 truncate">{link.label}</span>
        </MainPageLink>
    </div>;
}

type NavGroupProps = {
    label: string;
    links: LinkSpec[];
    open: boolean;
    setOpen: (open: boolean) => void;
    groupActive: boolean;
};

/**
 * The collapsed group for pages used rarely: a 12px/500 muted group label with a
 * chevron, no icon. It opens itself while one of its pages is active, keeps its links
 * mounted while collapsed, and carries the pill when it is folded over the active page.
 */
function NavGroup({ label, links, open, setOpen, groupActive }: NavGroupProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const state = useRowState(GROUP_KEY, groupActive && !open);
    useEffect(() => {
        if (contentRef.current) contentRef.current.inert = !open;
    }, [open]);
    if (!links.length) return null;
    return <div className="pt-2">
        <div data-nav-key={GROUP_KEY} data-nav-state={state} className="group">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className={cn(
                    'relative z-10 flex min-h-11 w-full items-center gap-2.5 rounded-md px-3.5 py-2 text-xs font-medium transition-colors duration-150',
                    'text-muted-foreground group-data-[nav-state=pill]:text-white group-data-[nav-state=active-pill]:text-accent-text',
                )}
            >
                <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
            </button>
        </div>
        <div
            ref={contentRef}
            aria-hidden={!open}
            className={cn(
                'grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-[opacity]',
                open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0',
            )}
        >
            <div className="overflow-hidden">
                <div className="flex flex-col gap-1 pt-1">
                    {links.map(link => <SidebarLink key={link.href} link={link} />)}
                </div>
            </div>
        </div>
    </div>;
}

export default function ServerMenu() {
    const [location] = useLocation();
    const isVisible = useLinkVisibilityFilter();

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
    const visibleEveryday = everyday.filter(isVisible);
    const visibleMore = more.filter(isVisible);

    //The group opens itself whenever one of its pages becomes active.
    const activeMoreLink = visibleMore.find(link => isLinkActive(location, link.href));
    const groupActive = !!activeMoreLink;
    const [groupOpen, setGroupOpen] = useState(groupActive);
    useEffect(() => {
        if (groupActive) setGroupOpen(true);
    }, [groupActive]);

    //Where the pill rests when nothing is hovered.
    const activeEveryday = visibleEveryday.find(link => isLinkActive(location, link.href));
    const restKey = activeEveryday
        ? activeEveryday.href
        : activeMoreLink
            ? (groupOpen ? activeMoreLink.href : GROUP_KEY)
            : null;
    const [hoverKey, setHoverKey] = useState<string | null>(null);
    const pillKey = hoverKey ?? restKey;

    //Pill geometry, measured from the row wrappers.
    const navRef = useRef<HTMLElement>(null);
    const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
    const [animatePill, setAnimatePill] = useState(false);
    const measure = useCallback(() => {
        const nav = navRef.current;
        if (!nav || !pillKey) return setPill(null);
        const row = Array.from(nav.querySelectorAll<HTMLElement>('[data-nav-key]'))
            .find(el => el.dataset.navKey === pillKey);
        if (!row || !row.offsetParent) return setPill(null);
        const navRect = nav.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        setPill(prev => {
            const next = { top: rowRect.top - navRect.top, height: rowRect.height };
            return prev && prev.top === next.top && prev.height === next.height ? prev : next;
        });
    }, [pillKey]);
    useLayoutEffect(measure, [measure, groupOpen, location, visibleEveryday.length, visibleMore.length]);
    useEffect(() => {
        const nav = navRef.current;
        if (!nav) return;
        const observer = new ResizeObserver(() => measure());
        observer.observe(nav);
        return () => observer.disconnect();
    }, [measure]);
    //No slide on first paint: the pill appears in place, then animates from there on.
    useEffect(() => {
        if (!pill || animatePill) return;
        const frame = requestAnimationFrame(() => setAnimatePill(true));
        return () => cancelAnimationFrame(frame);
    }, [pill, animatePill]);

    const keyFromEvent = (target: EventTarget | null) => (
        target instanceof Element ? target.closest<HTMLElement>('[data-nav-key]')?.dataset.navKey ?? null : null
    );

    return <PillContext.Provider value={pillKey}>
        <nav
            ref={navRef}
            aria-label={t('Main')}
            className="relative flex flex-col gap-1"
            onMouseOver={(event) => {
                const key = keyFromEvent(event.target);
                if (key) setHoverKey(key);
            }}
            onMouseLeave={() => setHoverKey(null)}
            onFocus={(event) => {
                if (event.target.matches(':focus-visible')) setHoverKey(keyFromEvent(event.target));
            }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHoverKey(null);
            }}
        >
            <div
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 z-0 rounded-md border border-hairline bg-raise motion-reduce:transition-none',
                    //Arbitrary duration/ease utilities are ambiguous next to tailwindcss-animate, so the transition is spelled out.
                    animatePill && '[transition:transform_220ms_cubic-bezier(0.16,1,0.3,1),height_220ms_cubic-bezier(0.16,1,0.3,1),opacity_150ms_ease]',
                    pill ? 'opacity-100' : 'opacity-0',
                )}
                style={pill ? { transform: `translateY(${pill.top}px)`, height: pill.height } : { height: 44 }}
            />
            {visibleEveryday.map(link => <SidebarLink key={link.href} link={link} />)}
            <NavGroup
                label={t('More')}
                links={visibleMore}
                open={groupOpen}
                setOpen={setGroupOpen}
                groupActive={groupActive}
            />
        </nav>
    </PillContext.Provider>;
}
