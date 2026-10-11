import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Avatar from '@/components/Avatar';
import { IconButton } from '@/components/ui/icon-button';
import { useAuth } from '@/hooks/auth';
import { useServerSheet } from '@/hooks/sheets';
import { ChevronDown, Menu } from 'lucide-react';
import { t } from '@/lib/i18n';
import { navigate } from 'wouter/use-browser-location';
import { NavLink } from '@/components/MainPageLink';
import PanelBrand from '@/components/PanelBrand';

export function Header() {
    const { authData, logout } = useAuth();
    const { setIsSheetOpen } = useServerSheet();
    if (!authData) return null;

    return <header className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <IconButton
                label={t('Open navigation')}
                icon={<Menu />}
                onClick={() => setIsSheetOpen(true)}
                className="-ml-2"
            />
            <NavLink href="/" className="min-w-0 rounded-sm">
                <PanelBrand compact useLogo />
            </NavLink>
        </div>
        <div className="hidden lg:block" />
        <DropdownMenu>
            <DropdownMenuTrigger className="flex min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm text-body transition-colors duration-150 hover:bg-raise hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text">
                <Avatar className="size-8 rounded-full text-xs" username={authData.name} profilePicture={authData.profilePicture} />
                <span className="hidden max-w-[12rem] truncate font-medium text-white sm:block">{authData.name}</span>
                <span className="hidden text-xs text-muted-foreground md:block">{authData.isMaster ? t('Master') : t('Staff')}</span>
                <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate('/user-settings')}>{t('User settings')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()}>{t('Sign out')}</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </header>;
}
