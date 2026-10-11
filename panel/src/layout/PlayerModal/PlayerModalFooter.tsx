import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerModalRefType, useClosePlayerModal } from "@/hooks/playerModal";
import { useBackendApi } from "@/hooks/fetch";
import { useAdminPerms } from "@/hooks/auth";
import { t } from '@/lib/i18n';
import { useOpenPromptDialog } from "@/hooks/dialogs";
import { GenericApiOkResp } from "@shared/genericApiTypes";
import { PlayerModalPlayerData } from "@shared/playerApiTypes";
import { useLocation, useRoute } from "wouter";
import { useContentRefresh } from "@/hooks/pages";
import { useCloseAllSheets } from "@/hooks/sheets";


type PlayerModalFooterProps = {
    playerRef: PlayerModalRefType,
    player?: PlayerModalPlayerData,
}

export default function PlayerModalFooter({ playerRef, player }: PlayerModalFooterProps) {
    const { hasPerm } = useAdminPerms();
    const openPromptDialog = useOpenPromptDialog();
    const closeModal = useClosePlayerModal();
    const setLocation = useLocation()[1];
    const [isAlreadyInAdminPage] = useRoute('/admins');
    const refreshContent = useContentRefresh();
    const closeAllSheets = useCloseAllSheets();
    const playerMessageApi = useBackendApi<GenericApiOkResp>({
        method: 'POST',
        path: `/player/message`,
    });
    const playerKickApi = useBackendApi<GenericApiOkResp>({
        method: 'POST',
        path: `/player/kick`,
    });
    const playerWarnApi = useBackendApi<GenericApiOkResp>({
        method: 'POST',
        path: `/player/warn`,
    });

    const closeOnSuccess = (data: GenericApiOkResp) => {
        if ('success' in data) {
            closeModal();
            closeAllSheets();
        }
    }

    const handleGiveAdmin = () => {
        if (!player) return;
        const params = new URLSearchParams();
        params.set("autofill", "true");
        params.set("name", player.pureName);
        for (const id of [...new Set([...player.idsOnline, ...player.idsOffline])]) {
            if (id.startsWith("discord:")) {
                params.set("discord", id);
            } else if (id.startsWith("fivem:")) {
                params.set("citizenfx", id);
            }
        }
        if (player.license) params.set("license", player.license);
        setLocation(`/admins?${params.toString()}`);
        console.log('isAlreadyInAdminPage', isAlreadyInAdminPage);
        if (isAlreadyInAdminPage) {
            refreshContent();
        }
        closeModal();
        closeAllSheets();
    }

    const handleDm = () => {
        if (!player) return;
        openPromptDialog({
            title: t('Message {name}', { name: player.displayName }),
            message: t('Send a private in-game message to this player.'),
            placeholder: t('Message'),
            submitLabel: t('Send message'),
            required: true,
            onSubmit: (input) => {
                playerMessageApi({
                    queryParams: playerRef,
                    data: { message: input },
                    genericHandler: { successMsg: t('Message sent.') },
                    toastLoadingMessage: t('Sending message...'),
                    success: closeOnSuccess,
                });
            }
        });
    }

    const handleKick = () => {
        if (!player) return;
        openPromptDialog({
            title: t('Kick {name}', { name: player.displayName }),
            message: t('Enter a kick reason or leave it blank.'),
            placeholder: t('Kick reason'),
            submitLabel: t('Kick player'),
            onSubmit: (input) => {
                playerKickApi({
                    queryParams: playerRef,
                    data: { reason: input },
                    genericHandler: { successMsg: t('Player kicked.') },
                    toastLoadingMessage: t('Kicking player...'),
                    success: closeOnSuccess,
                });
            }
        });
    }

    const handleWarn = () => {
        if (!player) return;
        openPromptDialog({
            title: t('Warn {name}', { name: player.displayName }),
            message: t('The warning is delivered now or when the player next connects.'),
            placeholder: t('Warning reason'),
            submitLabel: t('Warn player'),
            required: true,
            onSubmit: (input) => {
                playerWarnApi({
                    queryParams: playerRef,
                    data: { reason: input },
                    genericHandler: { successMsg: t('Player warned.') },
                    toastLoadingMessage: t('Warning player...'),
                    success: closeOnSuccess,
                });
            }
        });
    }

    return (
        <DialogFooter className="grid grid-cols-2 gap-2 border-t p-4 sm:flex sm:flex-row sm:justify-start">
            <Button
                variant='secondary'
                size='sm'
                disabled={!hasPerm('manage.admins') || !player || !player.isRegistered}
                onClick={handleGiveAdmin}
                className="sm:mr-auto"
            >
                {t('Give Admin')}
            </Button>
            <Button
                variant='secondary'
                size='sm'
                disabled={!hasPerm('players.direct_message') || !player || !player.isConnected}
                onClick={handleDm}
            >
                {t('Message')}
            </Button>
            <Button
                variant='secondary'
                size='sm'
                disabled={!hasPerm('players.warn') || !player}
                onClick={handleWarn}
            >
                {t('Warn')}
            </Button>
            <Button
                variant='outline-destructive'
                size='sm'
                disabled={!hasPerm('players.kick') || !player || !player.isConnected}
                onClick={handleKick}
            >
                {t('Kick')}
            </Button>
        </DialogFooter>
    )
}
