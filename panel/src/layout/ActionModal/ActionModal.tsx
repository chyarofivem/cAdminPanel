import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActionModalStateValue } from '@/hooks/actionModal';
import { useEffect, useState } from 'react';
import { useBackendApi } from '@/hooks/fetch';
import type { HistoryActionModalResp, HistoryActionModalSuccess } from '@shared/historyApiTypes';
import { t } from '@/lib/i18n';
import ActionIdsTab from './ActionIdsTab';
import ActionInfoTab from './ActionInfoTab';
import ActionModifyTab from './ActionModifyTab';

const modalTabs = [
    { id: 'info', title: 'Info' },
    { id: 'ids', title: 'IDs' },
    { id: 'revoke', title: 'Revoke' },
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
    const statusVariant = isRevoked
        ? 'default'
        : action?.type === 'warn' ? 'warning' : 'danger';

    return <Dialog
        open={isModalOpen}
        onOpenChange={open => {
            if (!open) closeModal();
        }}
    >
        <DialogContent className="flex max-h-[min(820px,calc(100vh-2rem))] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:p-0">
            <DialogHeader className="gap-2 px-4 pb-4 pt-4 sm:px-6 sm:pt-6">
                {action && <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant}>{isRevoked ? t('Revoked') : t('Active')}</Badge>
                </div>}
                <DialogTitle className="truncate">
                    {action ? t('{type} for {player}', {
                        type: action.type === 'ban' ? t('Ban') : t('Warning'),
                        player: playerName,
                    }) : modalError ? t('Punishment unavailable') : t('Loading punishment')}
                </DialogTitle>
                <DialogDescription className="truncate">
                    {action ? t('Issued by {admin}', { admin: action.author }) : t('Loading the complete punishment record.')}
                </DialogDescription>
            </DialogHeader>

            <Tabs
                value={selectedTab}
                onValueChange={value => setSelectedTab(value as ModalTab)}
                className="flex min-h-0 flex-1 flex-col"
            >
                <div className="px-4 sm:px-6">
                    <TabsList className="grid w-full grid-cols-3">
                        {modalTabs.map(tab => <TabsTrigger key={tab.id} value={tab.id}>
                            {t(tab.title)}
                        </TabsTrigger>)}
                    </TabsList>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    {!modalData ? <div className="flex min-h-72 flex-col justify-center">
                        {modalError ? <Alert variant="destructive">
                            <AlertTitle>{t('Punishment could not be loaded')}</AlertTitle>
                            <AlertDescription>{modalError}</AlertDescription>
                            <Button className="mt-4" variant="secondary" size="sm" onClick={() => setRefreshKey(key => key + 1)}>
                                {t('Try again')}
                            </Button>
                        </Alert> : <p role="status" className="text-center text-sm text-muted-foreground">
                            {t('Loading punishment...')}
                        </p>}
                    </div> : <>
                        <TabsContent value="info" className="mt-0">
                            <ActionInfoTab action={modalData.action} serverTime={modalData.serverTime} tsFetch={tsFetch} />
                        </TabsContent>
                        <TabsContent value="ids" className="mt-0">
                            <ActionIdsTab action={modalData.action} />
                        </TabsContent>
                        <TabsContent value="revoke" className="mt-0">
                            <ActionModifyTab
                                action={modalData.action}
                                refreshModalData={() => setRefreshKey(key => key + 1)}
                            />
                        </TabsContent>
                    </>}
                </div>
            </Tabs>
        </DialogContent>
    </Dialog>;
}
