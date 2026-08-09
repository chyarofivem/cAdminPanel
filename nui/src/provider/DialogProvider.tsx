import React, {
  ChangeEvent,
  createContext,
  ReactEventHandler,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  TextField,
} from "@mui/material";
import { CampaignRounded, MarkChatUnreadRounded } from "@mui/icons-material";
import { useKeyboardNavContext } from "./KeyboardNavProvider";
import { useSnackbar } from "notistack";
import { useTranslate } from "react-polyglot";
import { useSetDisableTab, useSetListenForExit } from "../state/keys.state";
import { txAdminMenuPage, usePageValue } from "../state/page.state";
import { Box } from "@mui/system";

interface InputDialogProps {
  title: string;
  description: string;
  placeholder: string;
  onSubmit: (inputValue: string) => void;
  isMultiline?: boolean;
  suggestions?: string[];
  composerTone?: "announcement" | "direct-message";
}

interface DialogProviderContext {
  openDialog: (dialogProps: InputDialogProps) => void;
  closeDialog: () => void;
  isDialogOpen: boolean;
}

const DialogContext = createContext(null);

const defaultDialogState = {
  description: "This is the default description for whatever",
  placeholder: "This is the default placeholder...",
  onSubmit: () => {},
  title: "Dialog Title",
};

interface DialogProviderProps {
  children: ReactNode;
}

export const DialogProvider: React.FC<DialogProviderProps> = ({ children }) => {
  const [canSubmit, setCanSubmit] = useState(true);

  const setDisableTabs = useSetDisableTab();
  const { setDisabledKeyNav } = useKeyboardNavContext();
  const setListenForExit = useSetListenForExit();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProps, setDialogProps] =
    useState<InputDialogProps>(defaultDialogState);
  const [dialogInputVal, setDialogInputVal] = useState<string>("");
  const { enqueueSnackbar } = useSnackbar();
  const curPage = usePageValue();
  const t = useTranslate();
  const ComposerIcon = dialogProps.composerTone === "announcement"
    ? CampaignRounded
    : MarkChatUnreadRounded;

  useEffect(() => {
    if (curPage === txAdminMenuPage.Main) {
      setDisabledKeyNav(dialogOpen);
      setDisableTabs(dialogOpen);
    }
  }, [dialogOpen, setDisabledKeyNav, setDisableTabs]);

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

    setListenForExit(true);
    setDialogOpen(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDialogInputVal(e.target.value);
  };

  const openDialog = useCallback((dialogProps: InputDialogProps) => {
    setDialogProps(dialogProps);
    setDialogOpen(true);
    setListenForExit(false);
  }, []);

  const handleDialogClose: ReactEventHandler<{}> = useCallback((e) => {
    e.stopPropagation();
    setDialogOpen(false);
    setListenForExit(true);
  }, []);

  // We reset default state after the animation is complete
  const handleOnExited = () => {
    setDialogProps(defaultDialogState);
    setCanSubmit(true);
    setDialogInputVal("");
  };

  return (
    <DialogContext.Provider
      value={{
        openDialog,
        closeDialog: handleDialogClose,
        isDialogOpen: dialogOpen,
      }}
    >
      <Dialog
        onClose={handleDialogClose}
        open={dialogOpen}
        fullWidth
        TransitionProps={{
          onExited: handleOnExited,
        }}
        PaperProps={{
          sx: {
            overflow: "hidden",
            borderRadius: 3,
            border: "1px solid",
            borderColor: "rgba(255,255,255,0.12)",
            backgroundColor: "rgba(16, 21, 26, 0.98)",
            backgroundImage: "none",
            boxShadow: "0 28px 80px rgba(0,0,0,0.55)",
          },
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleDialogSubmit();
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              px: 3,
              pt: 3,
              pb: 2,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {dialogProps.composerTone && (
              <Box
                aria-hidden="true"
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  borderRadius: 2,
                  color: dialogProps.composerTone === "announcement"
                    ? "#fbbf24"
                    : "primary.main",
                  bgcolor: dialogProps.composerTone === "announcement"
                    ? "rgba(251,191,36,0.12)"
                    : "rgba(0,197,140,0.12)",
                  border: "1px solid currentColor",
                }}
              >
                <ComposerIcon />
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Box
                component="h2"
                sx={{ m: 0, color: "text.primary", fontSize: 21, fontWeight: 750, lineHeight: 1.3 }}
              >
                {dialogProps.title}
              </Box>
              <DialogContentText sx={{ mt: 0.5, color: "text.secondary", lineHeight: 1.5 }}>
                {dialogProps.description}
              </DialogContentText>
            </Box>
          </Box>
          <DialogContent sx={{ px: 3, py: 2.5 }}>
            <TextField
              variant="outlined"
              autoFocus
              fullWidth
              multiline={dialogProps?.isMultiline}
              minRows={dialogProps?.isMultiline ? 4 : undefined}
              id="dialog-input"
              placeholder={dialogProps.placeholder}
              sx={{
                "& .MuiOutlinedInput-root": {
                  alignItems: "flex-start",
                  borderRadius: 2,
                  bgcolor: "rgba(0,0,0,0.2)",
                },
              }}
              onChange={handleChange}
              value={dialogInputVal}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 0, gap: 1, justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {Array.isArray(dialogProps.suggestions) && dialogProps.suggestions.map(suggestion => (
                  <Button
                    key={suggestion}
                    variant="outlined"
                    size="small"
                    onClick={()=>{
                      handleDialogSubmit(suggestion);
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  onClick={handleDialogClose}
                  variant="text"
                  color="secondary"
                >
                  {t("nui_menu.common.cancel")}
                </Button>
                <Button type="submit" color="primary" variant="contained">
                  {t("nui_menu.common.submit")}
                </Button>
              </Box>
          </DialogActions>
        </form>
      </Dialog>
      {children}
    </DialogContext.Provider>
  );
};

export const useDialogContext = () =>
  useContext<DialogProviderContext>(DialogContext);
