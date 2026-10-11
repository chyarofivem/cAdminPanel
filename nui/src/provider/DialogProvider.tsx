import React, {
  ChangeEvent,
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSnackbar } from "notistack";
import { useTranslate } from "react-polyglot";
import { useKeyboardNavContext } from "./KeyboardNavProvider";
import { useSetDisableTab, useSetListenForExit } from "../state/keys.state";
import { txAdminMenuPage, usePageValue } from "../state/page.state";
import { usePlayerModalVisbilityValue } from "../state/playerModal.state";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";

interface InputDialogProps {
  title: string;
  description: string;
  placeholder: string;
  onSubmit: (inputValue: string) => void;
  isMultiline?: boolean;
  suggestions?: string[];
  /** Kept for callers; the composer no longer draws a tone-specific icon. */
  composerTone?: "announcement" | "direct-message";
}

interface DialogProviderContext {
  openDialog: (dialogProps: InputDialogProps) => void;
  closeDialog: () => void;
  isDialogOpen: boolean;
}

const DialogContext = createContext<DialogProviderContext | null>(null);

const defaultDialogState: InputDialogProps = {
  description: "",
  placeholder: "",
  onSubmit: () => {},
  title: "",
};

interface DialogProviderProps {
  children: ReactNode;
}

/**
 * The single-input dialog used by the main page and the player modal.
 * Title and description in the header, the field in the body, suggestions as a
 * row of secondary buttons, then Cancel (left) and Submit (right).
 */
export const DialogProvider: React.FC<DialogProviderProps> = ({ children }) => {
  const [canSubmit, setCanSubmit] = useState(true);

  const setDisableTabs = useSetDisableTab();
  const { setDisabledKeyNav } = useKeyboardNavContext();
  const setListenForExit = useSetListenForExit();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProps, setDialogProps] = useState<InputDialogProps>(defaultDialogState);
  const [dialogInputVal, setDialogInputVal] = useState<string>("");
  const { enqueueSnackbar } = useSnackbar();
  const curPage = usePageValue();
  const isPlayerModalOpen = usePlayerModalVisbilityValue();
  const t = useTranslate();
  //A dialog opened from the player modal hands Escape back to the modal, not to
  //the global listener that closes the whole menu.
  const releaseExitKeys = useCallback(() => {
    setListenForExit(!isPlayerModalOpen);
  }, [isPlayerModalOpen, setListenForExit]);

  useEffect(() => {
    if (curPage === txAdminMenuPage.Main) {
      setDisabledKeyNav(dialogOpen);
      setDisableTabs(dialogOpen);
    }
  }, [dialogOpen, setDisabledKeyNav, setDisableTabs]);

  //There is no exit animation, so the dialog resets as soon as it closes.
  useEffect(() => {
    if (dialogOpen) return;
    setDialogProps(defaultDialogState);
    setCanSubmit(true);
    setDialogInputVal("");
  }, [dialogOpen]);

  const handleDialogSubmit = (suggested?: string) => {
    if (!canSubmit) return;

    const input = suggested ?? dialogInputVal;
    if (!input.trim()) {
      return enqueueSnackbar(t("nui_menu.misc.dialog_empty_input"), {
        variant: "error",
      });
    }

    dialogProps.onSubmit(input);
    setCanSubmit(false);

    releaseExitKeys();
    setDialogOpen(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDialogInputVal(e.target.value);
  };

  const openDialog = useCallback((dialogProps: InputDialogProps) => {
    setDialogProps(dialogProps);
    setDialogOpen(true);
    setListenForExit(false);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    releaseExitKeys();
  }, [releaseExitKeys]);

  return (
    <DialogContext.Provider
      value={{
        openDialog,
        closeDialog: handleDialogClose,
        isDialogOpen: dialogOpen,
      }}
    >
      <Modal
        open={dialogOpen}
        onClose={handleDialogClose}
        labelledBy="input-dialog-title"
        skipInitialFocus
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleDialogSubmit();
          }}
          style={{ display: "contents" }}
        >
          <div className="modal-header">
            <div style={{ minWidth: 0 }}>
              <h2 id="input-dialog-title" className="modal-title">{dialogProps.title}</h2>
              {dialogProps.description && (
                <p className="modal-description">{dialogProps.description}</p>
              )}
            </div>
          </div>
          <div className="modal-body">
            <label className="sr-only" htmlFor="dialog-input">{dialogProps.title}</label>
            {dialogProps.isMultiline ? (
              <textarea
                id="dialog-input"
                className="textarea"
                autoFocus
                rows={4}
                placeholder={dialogProps.placeholder}
                onChange={handleChange}
                value={dialogInputVal}
              />
            ) : (
              <input
                id="dialog-input"
                className="input"
                autoFocus
                autoComplete="off"
                placeholder={dialogProps.placeholder}
                onChange={handleChange}
                value={dialogInputVal}
              />
            )}
            {Array.isArray(dialogProps.suggestions) && dialogProps.suggestions.length > 0 && (
              <div className="chips" style={{ marginTop: 12 }}>
                {dialogProps.suggestions.map((suggestion) => (
                  <Button key={suggestion} small onClick={() => handleDialogSubmit(suggestion)}>
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <Button onClick={handleDialogClose}>{t("nui_menu.common.cancel")}</Button>
            <Button type="submit" variant="primary">{t("nui_menu.common.submit")}</Button>
          </div>
        </form>
      </Modal>
      {children}
    </DialogContext.Provider>
  );
};

export const useDialogContext = () => {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useDialogContext must be used within DialogProvider");
  return context;
};
