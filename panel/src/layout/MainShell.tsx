import { useEffect } from 'react';
import { useEventListener } from 'usehooks-ts';
import { navigate as setLocation } from 'wouter/use-browser-location';
import MainRouter from './MainRouter';
import { useExpireAuthData } from '../hooks/auth';
import { Header } from './Header';
import { ServerSidebar } from './ServerSidebar/ServerSidebar';
import MainSheets from './MainSheets';
import WarningBar from './WarningBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import PromptDialog from '@/components/PromptDialog';
import TxToaster from '@/components/TxToaster';
import PlayerModal from './PlayerModal/PlayerModal';
import { playerModalUrlParam, useOpenPlayerModal } from '@/hooks/playerModal';
import MainSocket from './MainSocket';
import { TooltipProvider } from '@/components/ui/tooltip';
import { hotkeyEventListener } from '@/lib/hotkeyEventListener';
import ActionModal from './ActionModal/ActionModal';
import { actionModalUrlParam, useOpenActionModal } from '@/hooks/actionModal';

export default function MainShell() {
    const expireSession = useExpireAuthData();
    const openPlayerModal = useOpenPlayerModal();
    const openActionModal = useOpenActionModal();

    useEventListener('message', (event: TxMessageEvent) => {
        if (event.data.type === 'logoutNotice') expireSession('child iframe', 'got logoutNotice');
        else if (event.data.type === 'openPlayerModal') openPlayerModal(event.data.ref);
        else if (event.data.type === 'navigateToPage') setLocation(event.data.href);
    });

    useEffect(() => {
        const pageUrl = new URL(window.location.toString());
        const playerRef = pageUrl.searchParams.get(playerModalUrlParam);
        const actionRef = pageUrl.searchParams.get(actionModalUrlParam);
        if (playerRef) {
            if (playerRef.includes('#')) {
                const [mutex, rawNetid] = playerRef.split('#');
                const netid = Number.parseInt(rawNetid);
                if (mutex && !Number.isNaN(netid)) openPlayerModal({ mutex, netid });
            } else openPlayerModal({ license: playerRef });
        } else if (actionRef) openActionModal(actionRef);
    }, []);

    useEventListener('keydown', hotkeyEventListener);

    return <TooltipProvider delayDuration={300} disableHoverableContent>
        <div className="flex h-screen bg-gradient-to-b from-[#101319] to-[#0b0d10] text-white">
            <ServerSidebar />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    <div className="container mx-auto px-4 py-2 md:px-8"><MainRouter /></div>
                </main>
            </div>
        </div>
        <MainSheets />
        <WarningBar />
        <ConfirmDialog />
        <PromptDialog />
        <TxToaster />
        <PlayerModal />
        <ActionModal />
        <MainSocket />
    </TooltipProvider>;
}
