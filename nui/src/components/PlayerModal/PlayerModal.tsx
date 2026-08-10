import React, { useEffect, useMemo, useState } from "react";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  BadgeRounded,
  BlockRounded,
  CloseRounded,
  ErrorOutlineRounded,
  FlashOnRounded,
  FormatListBulletedRounded,
  HistoryRounded,
  PersonRounded,
  RefreshRounded,
} from "@mui/icons-material";
import { useTranslate } from "react-polyglot";
import { useAssociatedPlayerValue } from "@nui/src/state/playerDetails.state";
import { usePermissionsValue } from "@nui/src/state/permissions.state";
import { usePlayersState } from "@nui/src/state/players.state";
import { userHasPerm } from "@nui/src/utils/miscUtils";
import { nuiTokens } from "@nui/src/styles/nuiTokens";
import type { PlayerModalTab } from "./PlayerModal.types";
import { usePlayerModalData } from "./usePlayerModalData";
import { PlayerActions } from "./views/PlayerActions";
import { PlayerOverview } from "./views/PlayerOverview";
import { PlayerIdentifiers } from "./views/PlayerIdentifiers";
import { PlayerHistory } from "./views/PlayerHistory";
import { PlayerBan } from "./views/PlayerBan";

type PlayerModalProps = {
  onClose: () => void;
};

type StatusViewProps = {
  message: string;
  title: string;
  error?: boolean;
  onClose?: () => void;
  onRetry?: () => void;
};

const StatusView: React.FC<StatusViewProps> = ({
  error,
  message,
  onClose,
  onRetry,
  title,
}) => {
  const t = useTranslate();

  return (
    <Box
      role={error ? "alert" : "status"}
      sx={{
        display: "flex",
        flex: 1,
        minHeight: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: 4,
        py: 6,
        textAlign: "center",
      }}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          display: "grid",
          width: 58,
          height: 58,
          mb: 2,
          placeItems: "center",
          borderRadius: 2.5,
          color: error ? theme.palette.error.light : theme.palette.primary.main,
          backgroundColor: alpha(
            error ? theme.palette.error.main : theme.palette.primary.main,
            0.12
          ),
          boxShadow: `inset 0 0 0 1px ${alpha(
            error ? theme.palette.error.main : theme.palette.primary.main,
            0.28
          )}`,
        })}
      >
        {error ? <ErrorOutlineRounded /> : <CircularProgress size={28} />}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 750 }}>
        {title}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mt: 0.75, maxWidth: 520, lineHeight: 1.55, overflowWrap: "anywhere" }}
      >
        {message}
      </Typography>
      {(onRetry || onClose) && (
        <Box sx={{ display: "flex", gap: 1, mt: 2.5 }}>
          {onClose && (
            <Button color="secondary" variant="text" onClick={onClose}>
              {t("nui_menu.player_modal.misc.close")}
            </Button>
          )}
          {onRetry && (
            <Button
              variant="contained"
              startIcon={<RefreshRounded />}
              onClick={onRetry}
            >
              {t("nui_menu.player_modal.misc.retry")}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

const PlayerModal: React.FC<PlayerModalProps> = ({ onClose }) => {
  const t = useTranslate();
  const target = useAssociatedPlayerValue();
  const players = usePlayersState();
  const permissions = usePermissionsValue();
  const liveTarget = target
    ? players.find((player) => player.id === target.id)
    : undefined;
  const targetIsCurrent = Boolean(
    target && liveTarget?.connectionRef === target.connectionRef
  );
  const { state, reload } = usePlayerModalData(targetIsCurrent ? target : null);
  const [tab, setTab] = useState<PlayerModalTab>("actions");
  const canBan = userHasPerm("players.ban", permissions);

  useEffect(() => {
    setTab("actions");
  }, [target?.connectionRef, target?.id]);

  useEffect(() => {
    if (tab === "ban" && !canBan) setTab("actions");
  }, [canBan, tab]);

  const readyState =
    targetIsCurrent
    && target
    && state.status === "ready"
    && state.targetId === target.id
    && state.targetConnectionRef === target.connectionRef
      ? state
      : null;
  const displayName = readyState?.details.player.displayName ?? target?.displayName;
  const playerInitial = useMemo(
    () => displayName?.trim().charAt(0).toLocaleUpperCase() || "?",
    [displayName]
  );

  const tabs = [
    {
      value: "actions" as const,
      label: t("nui_menu.player_modal.tabs.actions"),
      Icon: FlashOnRounded,
    },
    {
      value: "info" as const,
      label: t("nui_menu.player_modal.tabs.info"),
      Icon: PersonRounded,
    },
    {
      value: "identifiers" as const,
      label: t("nui_menu.player_modal.tabs.ids"),
      Icon: FormatListBulletedRounded,
    },
    {
      value: "history" as const,
      label: t("nui_menu.player_modal.tabs.history"),
      Icon: HistoryRounded,
    },
    {
      value: "ban" as const,
      label: t("nui_menu.player_modal.tabs.ban"),
      Icon: BlockRounded,
      disabled: !canBan,
    },
  ];

  const renderContent = () => {
    if (!target) {
      return (
        <StatusView
          error
          title={t("nui_menu.player_modal.misc.unavailable")}
          message={t("nui_menu.player_modal.misc.no_target")}
          onClose={onClose}
        />
      );
    }

    if (!targetIsCurrent) {
      return (
        <StatusView
          error
          title={t("nui_menu.player_modal.misc.unavailable")}
          message={t("nui_menu.player_modal.misc.disconnected")}
          onClose={onClose}
        />
      );
    }

    if (
      state.status === "idle"
      || state.status === "loading"
      || state.targetId !== target.id
      || state.targetConnectionRef !== target.connectionRef
    ) {
      return (
        <StatusView
          title={t("nui_menu.player_modal.misc.loading_title")}
          message={t("nui_menu.player_modal.misc.loading_message")}
        />
      );
    }

    if (state.status === "error") {
      return (
        <StatusView
          error
          title={t("nui_menu.player_modal.misc.load_failed")}
          message={state.message}
          onClose={onClose}
          onRetry={reload}
        />
      );
    }

    if (state.status !== "ready") return null;
    const viewProps = { details: state.details, target, reload };

    switch (tab) {
      case "info":
        return (
          <PlayerOverview
            {...viewProps}
            onShowHistory={() => setTab("history")}
          />
        );
      case "identifiers":
        return <PlayerIdentifiers {...viewProps} />;
      case "history":
        return <PlayerHistory {...viewProps} />;
      case "ban":
        return canBan ? <PlayerBan {...viewProps} /> : <PlayerActions {...viewProps} />;
      default:
        return <PlayerActions {...viewProps} />;
    }
  };

  return (
    <Box sx={{ display: "flex", height: "100%", minHeight: 0, flexDirection: "column" }}>
      <Box
        component="header"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 2,
          borderBottom: `1px solid ${nuiTokens.ring}`,
          background: "rgba(255,255,255,0.025)",
        }}
      >
        <Avatar
          aria-hidden="true"
          sx={(theme) => ({
            width: 44,
            height: 44,
            color: theme.palette.primary.main,
            bgcolor: alpha(theme.palette.primary.main, 0.14),
            boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`,
            fontSize: 17,
            fontWeight: 800,
          })}
        >
          {playerInitial}
        </Avatar>

        <Box minWidth={0} flex={1}>
          <Typography
            id="player-modal-title"
            noWrap
            title={displayName}
            sx={{ fontSize: 18, fontWeight: 780, lineHeight: 1.25 }}
          >
            {displayName ?? t("nui_menu.player_modal.misc.unavailable")}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
            {target && (
              <Chip
                size="small"
                icon={<BadgeRounded />}
                label={t("nui_menu.player_modal.misc.player_id", { id: target.id })}
                sx={{ height: 23, fontSize: 11.5 }}
              />
            )}
            {readyState && (
              <Chip
                size="small"
                label={
                  readyState.details.player.isRegistered
                    ? t("nui_menu.player_modal.misc.registered")
                    : t("nui_menu.player_modal.misc.unregistered")
                }
                color={readyState.details.player.isRegistered ? "primary" : "default"}
                variant="outlined"
                sx={{ height: 23, fontSize: 11.5 }}
              />
            )}
          </Box>
        </Box>

        {target && (
          <Tooltip title={t("nui_menu.player_modal.misc.refresh")} arrow>
            <span>
              <IconButton
                aria-label={t("nui_menu.player_modal.misc.refresh")}
                disabled={!targetIsCurrent || state.status === "loading"}
                onClick={reload}
              >
                {state.status === "loading" ? (
                  <CircularProgress size={20} />
                ) : (
                  <RefreshRounded />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}
        <IconButton
          aria-label={t("nui_menu.player_modal.misc.close")}
          onClick={onClose}
        >
          <CloseRounded />
        </IconButton>
      </Box>

      <Tabs
        value={tab}
        onChange={(_event, value: PlayerModalTab) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t("nui_menu.player_modal.misc.navigation")}
        sx={{
          flexShrink: 0,
          minHeight: 50,
          px: 1.5,
          borderBottom: `1px solid ${nuiTokens.ring}`,
          "& .MuiTab-root": {
            minHeight: 50,
            minWidth: 112,
            textTransform: "none",
            fontWeight: 720,
          },
        }}
      >
        {tabs.map(({ disabled, Icon, label, value }) => (
          <Tab
            key={value}
            value={value}
            label={label}
            icon={<Icon fontSize="small" />}
            iconPosition="start"
            disabled={disabled || !readyState}
            sx={
              value === "ban"
                ? {
                    color: "error.light",
                    "&.Mui-selected": { color: "error.light" },
                  }
                : undefined
            }
          />
        ))}
      </Tabs>

      <Box component="main" sx={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {renderContent()}
      </Box>
    </Box>
  );
};

export default PlayerModal;
