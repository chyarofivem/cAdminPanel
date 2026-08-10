import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setPlayerModalUrlParam, usePlayerModalStateValue } from "@/hooks/playerModal";
import { InfoIcon, ListIcon, HistoryIcon, GavelIcon, UserRoundCogIcon } from "lucide-react";
import PlayerInfoTab from "./PlayerInfoTab";
import { useEffect, useMemo, useState } from "react";
import PlayerIdsTab from "./PlayerIdsTab";
import PlayerHistoryTab from "./PlayerHistoryTab";
import PlayerBanTab from "./PlayerBanTab";
import GenericSpinner from "@/components/GenericSpinner";
import { cn } from "@/lib/utils";
import { useBackendApi } from "@/hooks/fetch";
import { PlayerModalResp, PlayerModalSuccess } from "@shared/playerApiTypes";
import PlayerModalFooter from "./PlayerModalFooter";
import { ModalContent, ModalTabMessage, ModalTabsList, ModalTabWrapper, type ModalTabInfo } from "@/components/modal-tabs";
import { useAdminPerms } from "@/hooks/auth";
import PlayerCharacterTab from "./PlayerCharacterTab";
import { t } from '@/lib/i18n';


const baseModalTabs: ModalTabInfo[] = [
    {
        title: 'Info',
        icon: <InfoIcon className="mr-2 h-5 w-5 hidden xs:block" />,
    },
    {
        title: 'History',
        icon: <HistoryIcon className="mr-2 h-5 w-5 hidden xs:block" />,
    },
    {
        title: 'IDs',
        icon: <ListIcon className="mr-2 h-5 w-5 hidden xs:block" />,
    },
    {
        title: 'Ban',
        icon: <GavelIcon className="mr-2 h-5 w-5 hidden xs:block" />,
        className: 'hover:bg-destructive hover:text-destructive-foreground',
    }
];


export default function PlayerModal() {
    const { hasPerm } = useAdminPerms();
    const canViewCharacter = window.txConsts.cadminEnabled && hasPerm('cadmin.players.view');
    const modalTabs = useMemo<ModalTabInfo[]>(() => {
        if (!canViewCharacter) return baseModalTabs;
        return [
            baseModalTabs[0],
            { title: 'Character', icon: <UserRoundCogIcon className="mr-2 h-5 w-5 hidden xs:block" /> },
            ...baseModalTabs.slice(1),
        ];
    }, [canViewCharacter]);
    const { isModalOpen, closeModal, playerRef } = usePlayerModalStateValue();
    const [selectedTab, setSelectedTab] = useState(modalTabs[0].title);
    const [currRefreshKey, setCurrRefreshKey] = useState(0);
    const [modalData, setModalData] = useState<PlayerModalSuccess | undefined>(undefined);
    const [modalError, setModalError] = useState('');
    const [tsFetch, setTsFetch] = useState(0);
    const playerQueryApi = useBackendApi<PlayerModalResp>({
        method: 'GET',
        path: `/player`,
        abortOnUnmount: true,
    });
    const actionPlayerRef = useMemo(() => {
        if (!playerRef || !modalData?.player.sessionRef) return playerRef;
        return { ...playerRef, sessionRef: modalData.player.sessionRef };
    }, [modalData?.player.sessionRef, playerRef]);

    //Helper for tabs to be able to refresh the modal data
    const refreshModalData = () => {
        setCurrRefreshKey(currRefreshKey + 1);
    };

    //Querying player data when reference is available
    useEffect(() => {
        if (!playerRef) return;
        setModalData(undefined);
        setModalError('');
        playerQueryApi({
            queryParams: playerRef,
            success: (resp) => {
                if ('error' in resp) {
                    setModalError(resp.error);
                } else {
                    setModalData(resp);
                    setTsFetch(Math.round(Date.now() / 1000));
                    //Update the ref param to use a license, if possible
                    if (!('license' in playerRef) && resp.player.license) {
                        setPlayerModalUrlParam(resp.player.license)
                    }
                }
            },
            error: (error) => {
                setModalError(error);
            },
        });
    }, [playerRef, currRefreshKey]);

    //Resetting selected tab when modal is closed
    useEffect(() => {
        if (!isModalOpen) {
            setTimeout(() => {
                setSelectedTab(modalTabs[0].title);
            }, 200);
        }
    }, [isModalOpen, modalTabs]);

    useEffect(() => {
        if (!modalTabs.some(tab => tab.title === selectedTab)) {
            setSelectedTab(modalTabs[0].title);
        }
    }, [modalTabs, selectedTab]);

    const handleOpenClose = (newOpenState: boolean) => {
        if (isModalOpen && !newOpenState) {
            closeModal();
        }
    };

    //Move to tab up or down
    const handleTabButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const currentIndex = modalTabs.findIndex((tab) => tab.title === selectedTab);
            const nextIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
            const nextTab = modalTabs[nextIndex];
            if (nextTab) {
                setSelectedTab(nextTab.title);
                const nextButton = document.getElementById(`player-modal-tab-${nextTab.title}`);
                if (nextButton) {
                    nextButton.focus();
                }
            }
        }
    }

    let pageTitle: JSX.Element;
    if (modalData) {
        if (modalData.player.netid) {
            pageTitle = <>
                <span className="text-success-inline font-mono mr-2">[{modalData.player.netid}]</span>
                {modalData.player.displayName}
            </>;
        } else {
            pageTitle = <>
                <span className="text-destructive-inline font-mono mr-2">[OFF]</span>
                {modalData.player.displayName}
            </>;
        }
    } else if (modalError) {
        pageTitle = <span className="text-destructive-inline">{t('Error')}</span>;
    } else {
        pageTitle = <span className="text-muted-foreground italic">{t('Loading...')}</span>;
    }

    return (
        <Dialog open={isModalOpen} onOpenChange={handleOpenClose}>
            <DialogContent className="max-w-2xl h-full sm:h-auto max-h-full p-0 gap-1 sm:gap-4 flex flex-col">
                <DialogHeader className="px-4 py-3 border-b">
                    <DialogTitle className="tracking-wide line-clamp-1 leading-7 break-all mr-6">
                        {pageTitle}
                    </DialogTitle>
                </DialogHeader>

                <ModalContent>
                    <ModalTabsList>
                        {modalTabs.map((tab) => (
                            <Button
                                id={`player-modal-tab-${tab.title}`}
                                key={tab.title}
                                variant={selectedTab === tab.title ? "secondary" : "ghost"}
                                className={cn(
                                    'w-full tracking-wider justify-center md:justify-start',
                                    'h-7 rounded-sm px-2 text-sm',
                                    'md:h-10 md:text-base',
                                    tab.className,
                                )}
                                onClick={() => setSelectedTab(tab.title)}
                                onKeyDown={handleTabButtonKeyDown}
                            >
                                {tab.icon} {t(tab.title)}
                            </Button>
                        ))}
                    </ModalTabsList>
                    
                    <ModalTabWrapper className="max-h-[calc(100vh-3.125rem-4rem-5rem)]">
                        {!modalData ? (
                            <ModalTabMessage>
                                {modalError ? (
                                    <span className="text-destructive-inline">{t('Error')}: {t(modalError)}</span>
                                ) : (
                                    <GenericSpinner msg={t('Loading...')} />
                                )}
                            </ModalTabMessage>
                        ) : (
                            <>
                                {selectedTab === 'Info' && <PlayerInfoTab
                                    player={modalData.player}
                                    playerRef={actionPlayerRef!}
                                    serverTime={modalData.serverTime}
                                    tsFetch={tsFetch}
                                    setSelectedTab={setSelectedTab}
                                    refreshModalData={refreshModalData}
                                />}
                                {selectedTab === 'History' && <PlayerHistoryTab
                                    actionHistory={modalData.player.actionHistory}
                                    serverTime={modalData.serverTime}
                                    refreshModalData={refreshModalData}
                                />}
                                {selectedTab === 'Character' && <PlayerCharacterTab license={modalData.player.license} />}
                                {selectedTab === 'IDs' && <PlayerIdsTab
                                    player={modalData.player}
                                    playerRef={actionPlayerRef!}
                                    refreshModalData={refreshModalData}
                                />}
                                {selectedTab === 'Ban' && <PlayerBanTab
                                    banTemplates={modalData.banTemplates}
                                    playerRef={actionPlayerRef!}
                                />}
                            </>
                        )}
                    </ModalTabWrapper>
                </ModalContent>
                <PlayerModalFooter
                    playerRef={actionPlayerRef!}
                    player={modalData?.player}
                />
            </DialogContent>
        </Dialog>
    );
}
