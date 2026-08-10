import React, { useMemo, useState } from "react";
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  styled,
  Typography,
} from "@mui/material";
import { HistoryToggleOffRounded } from "@mui/icons-material";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import type { GenericApiResp } from "@shared/genericApiTypes";
import type { PlayerHistoryItem } from "@shared/playerApiTypes";
import type { PlayerModalViewProps } from "../PlayerModal.types";
import { usePermissionsValue } from "@nui/src/state/permissions.state";
import { fetchWebPipe } from "@nui/src/utils/fetchWebPipe";
import { tsToLocaleDateTime, userHasPerm } from "@nui/src/utils/miscUtils";
import { nuiTokens } from "@nui/src/styles/nuiTokens";

const ViewRoot = styled(Box)({
  width: "100%",
  height: "100%",
  overflow: "auto",
  padding: 24,
});

type HistoryCardProps = {
  action: PlayerHistoryItem;
  canRevoke: boolean;
  isRevoking: boolean;
  serverTime: number;
  onRevoke: () => void;
};

const HistoryCard: React.FC<HistoryCardProps> = ({
  action,
  canRevoke,
  isRevoking,
  onRevoke,
  serverTime,
}) => {
  const t = useTranslate();
  const isBan = action.type === "ban";
  const isExpired = typeof action.exp === "number" && action.exp < serverTime;
  const authorMessage = isBan
    ? t("nui_menu.player_modal.history.banned_by", { author: action.author })
    : t("nui_menu.player_modal.history.warned_by", { author: action.author });

  const statusMessages: string[] = [];
  if (action.revokedBy) {
    statusMessages.push(
      t("nui_menu.player_modal.history.revoked_by", { author: action.revokedBy })
    );
  }
  if (typeof action.exp === "number") {
    statusMessages.push(
      isExpired
        ? t("nui_menu.player_modal.history.expired_at", {
            date: tsToLocaleDateTime(action.exp, "medium"),
          })
        : t("nui_menu.player_modal.history.expires_at", {
            date: tsToLocaleDateTime(action.exp, "medium"),
          })
    );
  }

  return (
    <Box
      component="article"
      sx={(theme) => {
        const actionColor = action.revokedBy || isExpired
          ? theme.palette.text.secondary
          : isBan
            ? theme.palette.error.main
            : theme.palette.warning.main;
        return {
          position: "relative",
          overflow: "hidden",
          p: 2,
          borderRadius: nuiTokens.radiusSm,
          backgroundColor: "rgba(255,255,255,0.035)",
          boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
          "&::before": {
            content: '\"\"',
            position: "absolute",
            inset: "0 auto 0 0",
            width: 4,
            backgroundColor: actionColor,
            boxShadow: `0 0 18px ${alpha(actionColor, 0.28)}`,
          },
        };
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <Box minWidth={0} flex={1}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 780 }}>
            {authorMessage}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ mt: 0.5, fontSize: 13.5, lineHeight: 1.5, overflowWrap: "anywhere" }}
          >
            {action.reason}
          </Typography>
        </Box>
        <Button
          size="small"
          color="secondary"
          variant="outlined"
          disabled={!canRevoke || isRevoking}
          startIcon={isRevoking ? <CircularProgress size={14} /> : undefined}
          onClick={onRevoke}
        >
          {t("nui_menu.player_modal.history.btn_revoke")}
        </Button>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 12px",
          mt: 1.25,
          color: "text.secondary",
          fontFamily: "monospace",
          fontSize: 11.5,
        }}
      >
        <span>{action.id}</span>
        <span>{tsToLocaleDateTime(action.ts, "medium")}</span>
        {statusMessages.map((message) => (
          <span key={message}>{message}</span>
        ))}
      </Box>
    </Box>
  );
};

export const PlayerHistory: React.FC<PlayerModalViewProps> = ({ details, reload }) => {
  const t = useTranslate();
  const { enqueueSnackbar } = useSnackbar();
  const permissions = usePermissionsValue();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const history = useMemo(
    () => [...details.player.actionHistory].reverse(),
    [details.player.actionHistory]
  );

  const handleRevoke = async (actionId: string) => {
    setRevokingId(actionId);
    try {
      const result = await fetchWebPipe<GenericApiResp>("/history/revokeAction", {
        method: "POST",
        data: { actionId },
      });
      if ("success" in result && result.success) {
        enqueueSnackbar(t("nui_menu.player_modal.history.revoked_success"), {
          variant: "success",
        });
        reload();
      } else {
        enqueueSnackbar(
          "error" in result ? result.error : t("nui_menu.misc.unknown_error"),
          { variant: "error" }
        );
      }
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : t("nui_menu.misc.unknown_error"),
        { variant: "error" }
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <ViewRoot>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 780 }}>
        {t("nui_menu.player_modal.history.title")}
      </Typography>

      {!history.length ? (
        <Box
          sx={{
            display: "flex",
            minHeight: 260,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: nuiTokens.radiusSm,
            color: "text.secondary",
            backgroundColor: "rgba(255,255,255,0.025)",
            boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
          }}
        >
          <HistoryToggleOffRounded sx={{ mb: 1, fontSize: 38, opacity: 0.65 }} />
          <Typography>{t("nui_menu.player_modal.history.empty")}</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {history.map((action) => {
            const requiredPermission =
              action.type === "ban" ? "players.ban" : "players.warn";
            return (
              <HistoryCard
                key={action.id}
                action={action}
                serverTime={details.serverTime}
                canRevoke={
                  !action.revokedBy && userHasPerm(requiredPermission, permissions)
                }
                isRevoking={revokingId === action.id}
                onRevoke={() => void handleRevoke(action.id)}
              />
            );
          })}
        </Box>
      )}
    </ViewRoot>
  );
};

