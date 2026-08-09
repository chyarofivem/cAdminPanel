import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/hooks/auth';
import { useServerSheet } from '@/hooks/sheets';
import { ChevronDown, KeyRound, LogOut, Menu, Settings2 } from 'lucide-react';
import { useAccountModal } from '@/hooks/dialogs';
import { t } from '@/lib/i18n';
import { navigate } from 'wouter/use-browser-location';

export function Header() {
    const { authData, logout } = useAuth();
    const { setIsSheetOpen } = useServerSheet();
    const { setAccountModalOpen } = useAccountModal();
    if (!authData) return null;

    return <header className="flex items-center justify-between border-b border-dashed border-white/5 p-4 text-white">
        <div className="flex items-center gap-4">
            <button type="button" onClick={() => setIsSheetOpen(true)} className="text-gray-500 transition-colors hover:text-white lg:hidden" aria-label="Toggle navigation">
                <Menu className="size-6" />
            </button>
        </div>
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl px-4 py-2 transition hover:scale-95 hover:bg-white/5 focus:outline-none">
                <Avatar className="size-8 rounded-full" username={authData.name} profilePicture={authData.discordAvatar || authData.profilePicture} />
                <span className="hidden font-medium text-white sm:block">{authData.email || authData.name}</span>
                <span className="hidden text-xs uppercase tracking-widest text-brand-500 md:block">{authData.isMaster ? t('master') : t('staff')}</span>
                <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-white/5 bg-[#181a1e] text-zinc-200">
                <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/user-settings')}><Settings2 className="mr-2 size-4" />{t('User settings')}</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setAccountModalOpen(true)}><KeyRound className="mr-2 size-4" />{t('Account details')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={() => logout()}><LogOut className="mr-2 size-4" />{t('Sign out')}</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </header>;
}
