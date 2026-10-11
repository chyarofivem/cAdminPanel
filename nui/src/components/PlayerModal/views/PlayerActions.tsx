import React from "react";
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
import { Button } from "@nui/src/components/ui/Button";

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
        //The Rockstar license is what every player has, so it is the surest in-game match
        if (identifier.startsWith("license:")) params.set("license", identifier);
      }
      goToFramePage(`/admins?${params}`);
      setModalOpen(false);
    });

  const requireOneSync = () => {
    if (serverCtx.oneSync.status) return true;
    enqueueSnackbar(t("nui_menu.misc.onesync_error"), { variant: "error" });
    return false;
  };

  const moderation = [
    { label: directMessageLabel, permission: "players.direct_message" as const, onClick: handleDirectMessage },
    { label: warnLabel, permission: "players.warn" as const, onClick: handleWarn },
    { label: kickLabel, permission: "players.kick" as const, onClick: handleKick, destructive: true },
    { label: giveAdminLabel, permission: "manage.admins" as const, onClick: handleGiveAdmin },
  ];

  const interaction = [
    {
      label: t("nui_menu.player_modal.actions.interaction.options.heal"),
      permission: "players.heal" as const,
      onClick: () => guard("players.heal", "Heal", () => {
        void runNuiAction("healPlayer");
      }),
    },
    {
      label: t("nui_menu.player_modal.actions.interaction.options.go_to"),
      permission: "players.teleport" as const,
      onClick: () => guard("players.teleport", "Teleport", () => {
        if (!requireOneSync()) return;
        void runNuiAction("tpToPlayer", true);
      }),
    },
    {
      label: t("nui_menu.player_modal.actions.interaction.options.bring"),
      permission: "players.teleport" as const,
      onClick: () => guard("players.teleport", "Teleport", () => {
        if (!requireOneSync()) return;
        void runNuiAction("summonPlayer", true);
      }),
    },
    {
      label: t("nui_menu.player_modal.actions.interaction.options.spectate"),
      permission: "players.spectate" as const,
      onClick: () => guard("players.spectate", "Spectate", () => {
        void runNuiAction("spectatePlayer", true);
      }),
    },
    {
      label: t("nui_menu.player_modal.actions.interaction.options.toggle_freeze"),
      permission: "players.freeze" as const,
      onClick: () => guard("players.freeze", "Freeze", () => {
        void runNuiAction("togglePlayerFreeze");
      }),
    },
  ];

  //Every action is a secondary button: none of them is the one primary action,
  //and kick is destructive, so it carries red text.
  return (
    <div className="stack">
      <section>
        <h3 className="heading">{t("nui_menu.player_modal.actions.moderation.title")}</h3>
        <div className="action-grid">
          {moderation.map((action) => (
            <Button
              key={action.label}
              destructive={action.destructive}
              disabled={!hasPermission(action.permission)}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="heading">{t("nui_menu.player_modal.actions.interaction.title")}</h3>
        <div className="action-grid">
          {interaction.map((action) => (
            <Button
              key={action.label}
              disabled={!hasPermission(action.permission)}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
};
