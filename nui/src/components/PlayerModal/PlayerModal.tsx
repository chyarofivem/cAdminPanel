import {
  Box,
  CircularProgress,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import {
  Block,
  Close,
  FlashOn,
  FormatListBulleted,
  MenuBook,
  Person,
} from "@mui/icons-material";
import {
  useAssociatedPlayerValue,
  usePlayerDetailsValue,
} from "../../state/playerDetails.state";
import { useTranslate } from "react-polyglot";
import { DialogBaseView } from "./Tabs/DialogBaseView";
import { PlayerModalErrorBoundary } from "./ErrorHandling/PlayerModalErrorBoundary";
import { usePermissionsValue } from "../../state/permissions.state";
import { userHasPerm } from "../../utils/miscUtils";
import React from "react";
import {
  PlayerModalTabs,
  usePlayerModalTabValue,
  useSetPlayerModalTab,
  useSetPlayerModalVisibility,
} from "@nui/src/state/playerModal.state";

const classes = {
  listItem: `PlayerModal-listItem`,
  listItemBan: `PlayerModal-listItemBan`,
};

const StyledList = styled(List)(({ theme }) => ({
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  [`& .${classes.listItem}`]: {
    minHeight: 46,
    borderRadius: 10,
    "&.Mui-selected:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
  },

  [`& .${classes.listItemBan}`]: {
    borderRadius: 8,
    "&:hover, &.Mui-selected": {
      background: theme.palette.error.main,
    },
    "&.Mui-selected:hover": {
      backgroundColor: "rgba(194,13,37, 0.8)",
    },
  },
}));

const LoadingModal: React.FC = () => (
  <Box
    display="flex"
    flexGrow={1}
    width="100%"
    justifyContent="center"
    alignItems="center"
  >
    <CircularProgress />
  </Box>
);

const StyledCloseButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: theme.spacing(1),
  right: theme.spacing(2),
}));

const ModalHeader = styled(DialogTitle)(({ theme }) => ({
  position: "relative",
  padding: "20px 64px 18px 24px",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  fontSize: 19,
  fontWeight: 600,
  lineHeight: 1.3,
  background: "rgba(255,255,255,0.025)",
  "& small": { display: "block", marginTop: 4, color: theme.palette.text.secondary, fontSize: 12, fontWeight: 500 },
}));

type PlayerModalProps = {
  onClose: () => void
};
const PlayerModal: React.FC<PlayerModalProps> = ({onClose}) => {
  const setModalOpen = useSetPlayerModalVisibility();
  const playerDetails = usePlayerDetailsValue();
  const assocPlayer = useAssociatedPlayerValue();

  if (!assocPlayer) return null;

  const error = playerDetails && 'error' in playerDetails ? playerDetails.error : undefined;
  const loadedPlayer = playerDetails && 'player' in playerDetails ? playerDetails.player : undefined;

  return (
    <>
      <ModalHeader>
        {loadedPlayer?.displayName ?? assocPlayer.displayName}
        <small>Player ID {assocPlayer.id}</small>
        <StyledCloseButton onClick={onClose} size="large">
          <Close />
        </StyledCloseButton>
      </ModalHeader>
      <Box display="flex" p={3} gap={3} flexGrow={1} overflow="hidden">
        <PlayerModalErrorBoundary>
          {error ? (
            <>
              <h2
                style={{
                  marginLeft: "auto",
                  marginRight: "auto",
                  textAlign: "center",
                  fontWeight: "500",
                  maxWidth: "70%",
                  paddingTop: "2em",
                }}
              >
                {error}
              </h2>
            </>
          ) : (
            <>
              <Box
                minWidth={220}
                pr={3}
                borderRight="1px solid rgba(255,255,255,0.1)"
              >
                <DialogList />
              </Box>
              <React.Suspense fallback={<LoadingModal />}>
                <DialogBaseView />
              </React.Suspense>
            </>
          )}
        </PlayerModalErrorBoundary>
      </Box>
    </>
  );
};

interface DialogTabProps {
  title: string;
  tab: PlayerModalTabs;
  curTab: PlayerModalTabs;
  icon: JSX.Element;
  isDisabled?: boolean;
}

const DialogTab: React.FC<DialogTabProps> = ({
  isDisabled,
  curTab,
  tab,
  icon,
  title,
}) => {
  const setTab = useSetPlayerModalTab();

  const stylingClass =
    tab === PlayerModalTabs.BAN ? classes.listItemBan : classes.listItem;

  const isSelected = curTab === tab;

  return (
    <ListItemButton
      className={stylingClass}
      selected={isSelected}
      onClick={() => setTab(tab)}
      disabled={isDisabled}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={title} />
    </ListItemButton>
  );
};

const DialogList: React.FC = () => {
  const curTab = usePlayerModalTabValue();
  const t = useTranslate();
  const playerPerms = usePermissionsValue();

  return (
    <StyledList>
      <DialogTab
        title={t("nui_menu.player_modal.tabs.actions")}
        tab={PlayerModalTabs.ACTIONS}
        curTab={curTab}
        icon={<FlashOn />}
      />
      <DialogTab
        title={t("nui_menu.player_modal.tabs.info")}
        tab={PlayerModalTabs.INFO}
        curTab={curTab}
        icon={<Person />}
      />
      <DialogTab
        title={t("nui_menu.player_modal.tabs.ids")}
        tab={PlayerModalTabs.IDENTIFIERS}
        curTab={curTab}
        icon={<FormatListBulleted />}
      />
      <DialogTab
        title={t("nui_menu.player_modal.tabs.history")}
        tab={PlayerModalTabs.HISTORY}
        curTab={curTab}
        icon={<MenuBook />}
      />
      <DialogTab
        title={t("nui_menu.player_modal.tabs.ban")}
        tab={PlayerModalTabs.BAN}
        curTab={curTab}
        icon={<Block />}
        isDisabled={!userHasPerm("players.ban", playerPerms)}
      />
    </StyledList>
  );
};

export default PlayerModal;
