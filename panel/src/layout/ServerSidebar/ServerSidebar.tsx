import { cn } from '@/lib/utils';
import { NavLink } from '@/components/MainPageLink';
import PanelBrand from '@/components/PanelBrand';
import ServerMenu from './ServerMenu';
import ServerControls from './ServerControls';
import { t } from '@/lib/i18n';

/**
 * The sidebar: 256px on the sidebar surface from 1024px up; below that it is
 * rendered inside the slide-in drawer (MainSheets).
 */
export function ServerSidebar({ isSheet }: { isSheet?: boolean }) {
    return <aside className={cn(
        'flex shrink-0 flex-col bg-sidebar text-body',
        isSheet ? 'min-h-full w-full' : 'hidden h-full w-64 overflow-y-auto lg:flex',
    )}>
        <div className="flex min-h-14 items-center px-4 pt-4">
            <NavLink href="/" className="rounded-sm">
                <PanelBrand />
            </NavLink>
        </div>
        <form action="/administration/players" method="get" className="px-3 pt-4" role="search">
            <label htmlFor={isSheet ? 'sidebar-player-search-sheet' : 'sidebar-player-search'} className="sr-only">{t('Search players')}</label>
            <input
                id={isSheet ? 'sidebar-player-search-sheet' : 'sidebar-player-search'}
                name="q"
                type="search"
                placeholder={t('Search players…')}
                className="h-11 w-full rounded-sm bg-sunken px-3 text-dense text-white ring-1 ring-inset ring-hairline transition-shadow duration-150 placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text sm:h-9"
            />
        </form>
        <div className="grow px-3 pt-4"><ServerMenu /></div>
        <div className="px-3 pb-3 pt-6">
            <div className="rounded-lg bg-raise p-4">
                <ServerControls />
            </div>
        </div>
        <footer className="px-4 pb-4 pt-1 text-micro text-faint">
            <div>Powered by cAdminPanel</div>
            <div className="mt-0.5 uppercase tracking-widest">
                Panel v{window.txConsts.txaVersion} · FX b{window.txConsts.fxsVersion}
            </div>
        </footer>
    </aside>;
}
