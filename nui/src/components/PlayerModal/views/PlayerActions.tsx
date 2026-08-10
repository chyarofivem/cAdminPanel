import React from "react";
import {
  alpha,
  Box,
  Button,
  styled,
  Typography,
} from "@mui/material";
import {
  AcUnitRounded,
  AdminPanelSettingsRounded,
  ChatRounded,
  HealthAndSafetyRounded,
  LogoutRounded,
  NearMeRounded,
  PersonPinCircleRounded,
  VisibilityRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import type { GenericApiResp } from "@shared/genericApiTypes";
import { getPlayerActionPath, type PlayerModalViewProps } from "../PlayerModal.types";
import type { ResolvablePermission } from "@nui/src/state/permissions.state";
import { usePermissionsValue } from "@nui/src/state/permissions.state";
import { useDialogContext } from "@nui/src/provider/DialogProvider";
import { useIFrameCtx } from "@nui/src/provider/IFrameProvider";
import { usePlayerModalContext } from "@nui/src/provider/PlayerModalProvider";
import { useSetPlayerModalVisibility } from "@nui/src/state/playerModal.state";
import { useServerCtxValue } from "@nui/src/state/server.state";
import { fetchNui } from "@nui/src/utils/fetchNui";
import { fetchWebPipe } from "@nui/src/utils/fetchWebPipe";
import { userHasPerm } from "@nui/src/utils/miscUtils";
import { nuiTokens } from "@nui/src/styles/nuiTokens";

const ViewRoot = styled(Box)({
  width: "100%",
  height: "100%",
  overflow: "auto",
  padding: 24,
});

const Section = styled(Box)(({ theme }) => ({
  padding: 18,
  borderRadius: nuiTokens.radiusSm,
  backgroundColor: "rgba(255,255,255,0.035)",
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
  "& + &": { marginTop: 16 },
  "& h3": {
    margin: 0,
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: 760,
  },
}));

const ActionGrid = styled(Box)({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginTop: 14,
});

const ActionButton = styled(Button)(({ theme }) => ({
  minHeight: 48,
  justifyContent: "flex-start",
  padding: "10px 13px",
  color: theme.palette.text.primary,
  borderColor: nuiTokens.ringStrong,
  backgroundColor: "rgba(0,0,0,0.14)",
  "& .MuiButton-startIcon": {
    color: theme.palette.primary.main,
  },
  "&:hover": {
    borderColor: alpha(theme.palette.primary.main, 0.7),
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
}));

export const PlayerActions: React.FC<PlayerModalViewProps> = ({ details, target }) => {
  const t = useTranslate();
  const { enqueueSnackbar } = useSnackbar();
  const permissions = usePermissionsValue();
  const serverCtx = useServerCtxValue();
  const { openDialog } = useDialogContext();
  const { goToFramePage } = useIFrameCtx();
  const { closeMenu, showNoPerms } = usePlayerModalContext();
  const setModalOpen = useSetPlayerModalVisibility();

  const hasPermission = (permission: ResolvablePermission) =>
    userHasPerm(permission, permissions);

  const guard = (
    permission: ResolvablePermission,
    label: string,
    callback: () => void
  ) => {
    if (!hasPermission(permission)) return showNoPerms(label);
    callback();
  };

  const showRequestError = (error: unknown) => {
    enqueueSnackbar(
      error instanceof Error && error.message
        ? error.message
        : t("nui_menu.misc.unknown_error"),
      { variant: "error" }
    );
  };

  const runApiAction = async (
    path: `/${string}`,
    data: Record<string, unknown>,
    successKey: string
  ) => {
    try {
      const result = await fetchWebPipe<GenericApiResp>(path, {
        method: "POST",
        data,
      });
      if ("success" in result && result.success) {
        enqueueSnackbar(t(successKey), { variant: "success" });
        return;
      }
      enqueueSnackbar(
        "error" in result ? result.error : t("nui_menu.misc.unknown_error"),
        { variant: "error" }
      );
    } catch (error) {
      showRequestError(error);
    }
  };

  const runNuiAction = async (
    eventName: string,
    closeAfterDispatch = false
  ) => {
    try {
      await fetchNui(
        eventName,
        { id: target.id, connectionRef: target.connectionRef },
        { mockResp: {} }
      );
      if (closeAfterDispatch) closeMenu();
    } catch (error) {
      showRequestError(error);
    }
  };

  const directMessageLabel = t(
    "nui_menu.player_modal.actions.moderation.options.dm"
  );
  const warnLabel = t("nui_menu.player_modal.actions.moderation.options.warn");
  const kickLabel = t("nui_menu.player_modal.actions.moderation.options.kick");
  const giveAdminLabel = t(
    "nui_menu.player_modal.actions.moderation.options.set_admin"
  );

  const handleDirectMessage = () =>
    guard("players.direct_message", directMessageLabel, () => {
      openDialog({
        title: `${t(
          "nui_menu.player_modal.actions.moderation.dm_dialog.title"
        )} ${target.displayName}`,
        description: t(
          "nui_menu.player_modal.actions.moderation.dm_dialog.description"
        ),
        placeholder: t(
          "nui_menu.player_modal.actions.moderation.dm_dialog.placeholder"
        ),
        isMultiline: true,
        composerTone: "direct-message",
        onSubmit: (message) => {
          void runApiAction(
            getPlayerActionPath("message", target, details),
            { message: message.trim() },
            "nui_menu.player_modal.actions.moderation.dm_dialog.success"
          );
        },
      });
    });

  const handleWarn = () =>
    guard("players.warn", warnLabel, () => {
      openDialog({
        title: `${t(
          "nui_menu.player_modal.actions.moderation.warn_dialog.title"
        )} ${target.displayName}`,
        description: t(
          "nui_menu.player_modal.actions.moderation.warn_dialog.description"
        ),
        placeholder: t(
          "nui_menu.player_modal.actions.moderation.warn_dialog.placeholder"
        ),
        onSubmit: (reason) => {
          void runApiAction(
            getPlayerActionPath("warn", target, details),
            { reason: reason.trim() },
            "nui_menu.player_modal.actions.moderation.warn_dialog.success"
          );
        },
      });
    });

  const handleKick = () =>
    guard("players.kick", kickLabel, () => {
      openDialog({
        title: `${t(
          "nui_menu.player_modal.actions.moderation.kick_dialog.title"
        )} ${target.displayName}`,
        description: t(
          "nui_menu.player_modal.actions.moderation.kick_dialog.description"
        ),
        placeholder: t(
          "nui_menu.player_modal.actions.moderation.kick_dialog.placeholder"
        ),
        onSubmit: (reason) => {
          void runApiAction(
            getPlayerActionPath("kick", target, details),
            { reason: reason.trim() },
            "nui_menu.player_modal.actions.moderation.kick_dialog.success"
          );
        },
      });
    });

  const handleGiveAdmin = () =>
    guard("manage.admins", giveAdminLabel, () => {
      const params = new URLSearchParams({
        autofill: "true",
        name: details.player.pureName,
      });
      for (const identifier of details.player.idsOnline) {
        if (identifier.startsWith("discord:")) params.set("discord", identifier);
        if (identifier.startsWith("fivem:")) params.set("citizenfx", identifier);
      }
      goToFramePage(`/admins?${params}`);
      setModalOpen(false);
    });

  const requireOneSync = () => {
    if (serverCtx.oneSync.status) return true;
    enqueueSnackbar(t("nui_menu.misc.onesync_error"), { variant: "error" });
    return false;
  };

  return (
    <ViewRoot>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 780 }}>
        {t("nui_menu.player_modal.actions.title")}
      </Typography>

      <Section>
        <Typography component="h3">
          {t("nui_menu.player_modal.actions.moderation.title")}
        </Typography>
        <ActionGrid>
          <ActionButton
            variant="outlined"
            startIcon={<ChatRounded />}
            disabled={!hasPermission("players.direct_message")}
            onClick={handleDirectMessage}
          >
            {directMessageLabel}
          </ActionButton>
          <ActionButton
            variant="outlined"
            startIcon={<WarningAmberRounded />}
            disabled={!hasPermission("players.warn")}
            onClick={handleWarn}
          >
            {warnLabel}
          </ActionButton>
          <ActionButton
            variant="outlined"
            startIcon={<LogoutRounded />}
            disabled={!hasPermission("players.kick")}
            onClick={handleKick}
          >
            {kickLabel}
          </ActionButton>
          <ActionButton
            variant="outlined"
            startIcon={<AdminPanelSettingsRounded />}
            disabled={!hasPermission("manage.admins")}
            onClick={handleGiveAdmin}
          >
            {giveAdminLabel}
          </ActionButton>
        </ActionGrid>
      </Section>

      <Section>
        <Typography component="h3">
          {t("nui_menu.player_modal.actions.interaction.title")}
        </Typography>
        <ActionGrid>
          <ActionButton
            variant="outlined"
            startIcon={<HealthAndSafetyRounded />}
            disabled={!hasPermission("players.heal")}
            onClick={() =>
              guard("players.heal", "Heal", () => {
                void runNuiAction("healPlayer");
              })
            }
          >
            {t("nui_menu.player_modal.actions.interaction.options.heal")}
          </ActionButton>
          <ActionButton
            variant="outlined"
            startIcon={<NearMeRounded />}
            disabled={!hasPermission("players.teleport")}
            onClick={() =>
              guard("players.teleport", "Teleport", () => {
                if (!requireOneSync()) return;
                void runNuiAction(
                  "tpToPlayer",
                  true
                );
              })
            }
          >
            {t("nui_menu.player_modal.actions.interaction.options.go_to")}
          </ActionButton>
          <ActionButton
            variant="outlined"
            startIcon={<PersonPinCircleRounded />}
            disabled={!hasPermission("players.teleport")}
            onClick={() =>
              guard("players.teleport", "Teleport", () => {
                if (!requireOneSync()) return;
                void runNuiAction(
                  "summonPlayer",
                  true
                );
              })
            }
          >
            {t("nui_menu.player_modal.actions.interaction.options.bring")}
          </ActionButton>
          <ActionButton
            variant="outlined"
            startIcon={<VisibilityRounded />}
            disabled={!hasPermission("players.spectate")}
            onClick={() =>
              guard("players.spectate", "Spectate", () => {
                void runNuiAction("spectatePlayer", true);
              })
            }
          >
            {t("nui_menu.player_modal.actions.interaction.options.spectate")}
          </ActionButton>
          <ActionButton
            variant="outlined"
            startIcon={<AcUnitRounded />}
            disabled={!hasPermission("players.freeze")}
            onClick={() =>
              guard("players.freeze", "Freeze", () => {
                void runNuiAction("togglePlayerFreeze");
              })
            }
          >
            {t("nui_menu.player_modal.actions.interaction.options.toggle_freeze")}
          </ActionButton>
        </ActionGrid>
      </Section>
    </ViewRoot>
  );
};
