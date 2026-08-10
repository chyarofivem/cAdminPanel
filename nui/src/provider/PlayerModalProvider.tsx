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
import { Dialog } from "@mui/material";
import { usePlayerModalVisibility } from "@nui/src/state/playerModal.state";
import { txAdminMenuPage, usePageValue } from "../state/page.state";

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
      <Dialog
        open={modalOpen}
        fullWidth
        onClose={handleClose}
        maxWidth="lg"
        PaperProps={{
          sx: {
            width: "min(980px, calc(100vw - 48px))",
            height: "min(680px, calc(100vh - 48px))",
            maxHeight: "calc(100vh - 48px)",
            overflow: "hidden",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.12)",
            backgroundColor: "background.default",
            backgroundImage: "none",
            boxShadow: "0 30px 90px rgba(0,0,0,0.58)",
          },
          id: "player-modal-container",
        }}
      >
        <PlayerModal onClose={handleClose} />
      </Dialog>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayerModalContext = () => useContext(PlayerContext);
