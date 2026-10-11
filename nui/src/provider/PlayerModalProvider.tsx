import React, {
  useContext,
  createContext,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import PlayerModal from "../components/PlayerModal/PlayerModal";
import { useSetDisableTab, useSetListenForExit } from "../state/keys.state";
import { useIsMenuVisible } from "../state/visibility.state";
import { fetchNui } from "../utils/fetchNui";
import { useSnackbar } from "notistack";
import { usePlayerModalVisibility } from "@nui/src/state/playerModal.state";
import { txAdminMenuPage, usePageValue } from "../state/page.state";
import { Modal } from "../components/ui/Modal";

const PlayerContext = createContext<PlayerProviderCtx>({} as PlayerProviderCtx);

interface PlayerProviderCtx {
  closeMenu: () => void;
  showNoPerms: (opt: string) => void;
}

interface PlayerModalProviderProps {
  children: ReactNode;
}

export const PlayerModalProvider: React.FC<PlayerModalProviderProps> = ({
  children,
}) => {
  const [modalOpen, setModalOpen] = usePlayerModalVisibility();
  const setDisableTabNav = useSetDisableTab();
  const setListenForExit = useSetListenForExit();
  const { enqueueSnackbar } = useSnackbar();
  const [menuVisible, setMenuVisible] = useIsMenuVisible();
  const curPage = usePageValue();

  useEffect(() => {
    setDisableTabNav(modalOpen);
    setListenForExit(!modalOpen);
  }, [modalOpen, setDisableTabNav, setListenForExit]);

  // In case the modal is open when menu visibility is toggled
  // we need to close the modal as a result
  useEffect(() => {
    if (!menuVisible && modalOpen) setModalOpen(false);
  }, [menuVisible, modalOpen, setModalOpen]);

  // Will close both the modal and set the menu to invisible
  const closeMenu = useCallback(() => {
    setModalOpen(false);
    setMenuVisible(false);
    fetchNui("closeMenu").catch(() => {});
  }, [setMenuVisible, setModalOpen]);

  const showNoPerms = useCallback((opt: string) => {
    enqueueSnackbar(`You do not have permissions for "${opt}"`, {
      variant: "error",
    });
  }, [enqueueSnackbar]);

  const handleClose = useCallback(() => {
    if (curPage === txAdminMenuPage.PlayerModalOnly) {
      closeMenu();
    } else {
      setModalOpen(false);
    }
  }, [closeMenu, curPage, setModalOpen]);

  return (
    <PlayerContext.Provider
      value={{
        showNoPerms,
        closeMenu,
      }}
    >
      <Modal
        open={modalOpen}
        onClose={handleClose}
        labelledBy="player-modal-title"
        id="player-modal-container"
        wide
      >
        <PlayerModal onClose={handleClose} />
      </Modal>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayerModalContext = () => useContext(PlayerContext);
