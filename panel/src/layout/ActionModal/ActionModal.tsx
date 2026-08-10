import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useActionModalStateValue } from '@/hooks/actionModal';
import { AlertCircle, Fingerprint, Info, RefreshCw, ShieldBan, TriangleAlert, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useBackendApi } from '@/hooks/fetch';
import type { HistoryActionModalResp, HistoryActionModalSuccess } from '@shared/historyApiTypes';
import { t } from '@/lib/i18n';
import ActionIdsTab from './ActionIdsTab';
import ActionInfoTab from './ActionInfoTab';
import ActionModifyTab from './ActionModifyTab';

const modalTabs = [
    { id: 'info', title: 'Info', icon: Info },
    { id: 'ids', title: 'IDs', icon: Fingerprint },
    { id: 'revoke', title: 'Revoke', icon: Undo2 },
] as const;

type ModalTab = typeof modalTabs[number]['id'];

export default function ActionModal() {
    const { isModalOpen, closeModal, actionRef } = useActionModalStateValue();
    const [selectedTab, setSelectedTab] = useState<ModalTab>('info');
    const [refreshKey, setRefreshKey] = useState(0);
    const [modalData, setModalData] = useState<HistoryActionModalSuccess>();
    const [modalError, setModalError] = useState('');
    const [tsFetch, setTsFetch] = useState(0);
    const historyGetActionApi = useBackendApi<HistoryActionModalResp>({
        method: 'GET',
        path: '/history/action',
        abortOnUnmount: true,
    });

    useEffect(() => {
        if (!actionRef) return;
        setModalData(undefined);
        setModalError('');
        historyGetActionApi({
            queryParams: { id: actionRef },
            success: (response) => {
                if ('error' in response) {
                    setModalError(response.error);
                    return;
                }
                setModalData(response);
                setTsFetch(Math.round(Date.now() / 1000));
            },
            error: setModalError,
        });
    }, [actionRef, refreshKey]);

    useEffect(() => {
        if (isModalOpen) setSelectedTab('info');
    }, [actionRef, isModalOpen]);

    const action = modalData?.action;
    const playerName = action?.playerName || t('Unknown player');
    const isRevoked = Boolean(action?.revocation.timestamp);
    const ActionIcon = action?.type === 'warn' ? TriangleAlert : ShieldBan;

    return <Dialog
        open={isModalOpen}
        onOpenChange={open => {
            if (!open) closeModal();
        }}
    >
        <DialogContent className="flex max-h-[min(820px,calc(100vh-2rem))] max-w-3xl flex-col gap-0 overflow-hidden border-white/10 bg-zinc-950/95 p-0 shadow-2xl shadow-black/60">
            <DialogHeader className="relative overflow-hidden border-b border-white/5 bg-gradient-to-br from-white/[0.055] to-transparent px-6 py-5 pr-14 text-left">
                <div className="flex min-w-0 items-center gap-4">
                    <span className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-xl border',
                        action?.type === 'warn'
                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                            : 'border-red-500/20 bg-red-500/10 text-red-300',
                    )}>
                        <ActionIcon className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-white/10 bg-white/5 font-mono text-[10px] text-zinc-400">
                                {action?.id || actionRef || t('Loading')}
                            </Badge>
                            {action && <Badge
                                variant="outline"
                                className={cn(
                                    'text-[10px] uppercase tracking-wider',
                                    isRevoked
                                        ? 'border-zinc-600/40 bg-zinc-700/20 text-zinc-400'
                                        : action.type === 'warn'
                                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                            : 'border-red-500/20 bg-red-500/10 text-red-300',
                                )}
                            >
                                {isRevoked ? t('Revoked') : t('Active')}
                            </Badge>}
                        </div>
                        <DialogTitle className="truncate text-xl text-white">
                            {action ? t('{type} for {player}', {
                                type: action.type === 'ban' ? t('Ban') : t('Warning'),
                                player: playerName,
                            }) : modalError ? t('Punishment unavailable') : t('Loading punishment')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 truncate text-xs text-zinc-500">
                            {action ? t('Issued by {admin}', { admin: action.author }) : t('Loading the complete punishment record.')}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="border-b border-white/5 bg-black/20 px-4 py-3 sm:px-6">
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.025] p-1">
                    {modalTabs.map(tab => {
                        const Icon = tab.icon;
                        return <Button
                            key={tab.id}
                            variant="ghost"
                            className={cn(
                                'h-9 rounded-lg text-xs text-zinc-500 transition-all duration-200 sm:text-sm',
                                selectedTab === tab.id && 'bg-white/[0.08] text-white shadow-sm hover:bg-white/[0.08]',
                                tab.id === 'revoke' && selectedTab !== tab.id && 'hover:text-red-300',
                            )}
                            onClick={() => setSelectedTab(tab.id)}
                        >
                            <Icon className="mr-2 size-4" />{t(tab.title)}
                        </Button>;
                    })}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                {!modalData ? <div className="grid min-h-72 place-items-center text-center">
                    {modalError ? <div className="max-w-md">
                        <span className="mx-auto grid size-12 place-items-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300">
                            <AlertCircle className="size-5" />
                        </span>
                        <h3 className="mt-4 font-medium text-white">{t('Punishment could not be loaded')}</h3>
                        <p className="mt-2 text-sm text-zinc-500">{modalError}</p>
                        <Button className="mt-5" variant="outline" onClick={() => setRefreshKey(key => key + 1)}>
                            <RefreshCw className="mr-2 size-4" />{t('Try again')}
                        </Button>
                    </div> : <div className="text-sm text-zinc-500">
                        <RefreshCw className="mx-auto mb-3 size-5 animate-spin text-brand-400" />
                        {t('Loading punishment...')}
                    </div>}
                </div> : <div key={selectedTab} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
                    {selectedTab === 'info' && <ActionInfoTab action={modalData.action} serverTime={modalData.serverTime} tsFetch={tsFetch} />}
                    {selectedTab === 'ids' && <ActionIdsTab action={modalData.action} />}
                    {selectedTab === 'revoke' && <ActionModifyTab
                        action={modalData.action}
                        refreshModalData={() => setRefreshKey(key => key + 1)}
                    />}
                </div>}
            </div>
        </DialogContent>
    </Dialog>;
}
