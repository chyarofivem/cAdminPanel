import { useEffect, useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { navigate as setLocation } from 'wouter/use-browser-location';
import { useLocation } from 'wouter';
import { ArrowUp } from 'lucide-react';
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
import { t } from '@/lib/i18n';

export default function MainShell() {
    const expireSession = useExpireAuthData();
    const openPlayerModal = useOpenPlayerModal();
    const openActionModal = useOpenActionModal();
    const [location] = useLocation();
    const mainRef = useRef<HTMLElement>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);

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

    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0 });
        setShowScrollTop(false);
    }, [location]);

    useEffect(() => {
        const main = mainRef.current;
        if (!main) return;
        const updateScrollTop = () => setShowScrollTop(main.scrollTop > 560);
        main.addEventListener('scroll', updateScrollTop, { passive: true });
        return () => main.removeEventListener('scroll', updateScrollTop);
    }, []);

    return <TooltipProvider delayDuration={300} disableHoverableContent>
        <div className="flex h-screen bg-gradient-to-b from-[#101319] to-[#0b0d10] text-white">
            <a href="#panel-content" className="tx-skip-link">{t('Skip to page content')}</a>
            <ServerSidebar />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <Header />
                <main ref={mainRef} id="panel-content" tabIndex={-1} className="scroll-smooth flex-1 overflow-x-hidden overflow-y-auto">
                    <div className="container mx-auto px-4 py-2 md:px-8"><MainRouter /></div>
                </main>
            </div>
            <button
                type="button"
                aria-label={t('Scroll to top')}
                title={t('Scroll to top')}
                onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                className={`tx-scroll-top ${showScrollTop ? 'tx-scroll-top-visible' : ''}`}
            >
                <ArrowUp className="size-4" />
            </button>
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
