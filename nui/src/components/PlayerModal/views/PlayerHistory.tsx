import React, { useMemo, useState } from "react";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import type { GenericApiResp } from "@shared/genericApiTypes";
import type { PlayerHistoryItem } from "@shared/playerApiTypes";
import type { PlayerModalViewProps } from "../PlayerModal.types";
import { usePermissionsValue } from "@nui/src/state/permissions.state";
import { fetchWebPipe } from "@nui/src/utils/fetchWebPipe";
import { tsToLocaleDateTime, userHasPerm } from "@nui/src/utils/miscUtils";
import { Badge } from "@nui/src/components/ui/Badge";
import { Button } from "@nui/src/components/ui/Button";

type HistoryRowProps = {
  action: PlayerHistoryItem;
  canRevoke: boolean;
  isRevoking: boolean;
  serverTime: number;
  onRevoke: () => void;
};

/**
 * One moderation record. Its state is a word (Ban, Warn, Revoked, Expired),
 * never a coloured stripe alone.
 */
const HistoryRow: React.FC<HistoryRowProps> = ({
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
    statusMessages.push(t("nui_menu.player_modal.history.revoked_by", { author: action.revokedBy }));
  }
  if (typeof action.exp === "number") {
    statusMessages.push(
      isExpired
        ? t("nui_menu.player_modal.history.expired_at", { date: tsToLocaleDateTime(action.exp, "medium") })
        : t("nui_menu.player_modal.history.expires_at", { date: tsToLocaleDateTime(action.exp, "medium") })
    );
  }

  const badge = action.revokedBy
    ? <Badge>{t("nui_menu.player_modal.history.state_revoked")}</Badge>
    : isExpired
      ? <Badge>{t("nui_menu.player_modal.history.state_expired")}</Badge>
      : isBan
        ? <Badge variant="danger">{t("nui_menu.player_modal.history.state_ban")}</Badge>
        : <Badge variant="warning">{t("nui_menu.player_modal.history.state_warn")}</Badge>;

  return (
    <article className="row history-row">
      <div className="history-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {badge}
            <span className="text-white">{authorMessage}</span>
          </div>
          <p style={{ marginTop: 6, overflowWrap: "anywhere" }}>{action.reason}</p>
        </div>
        {!action.revokedBy && (
          <Button small destructive disabled={!canRevoke || isRevoking} onClick={onRevoke}>
            {t("nui_menu.player_modal.history.btn_revoke")}
          </Button>
        )}
      </div>
      <div className="history-meta">
        <span>{action.id}</span>
        <span>{tsToLocaleDateTime(action.ts, "medium")}</span>
        {statusMessages.map((message) => <span key={message}>{message}</span>)}
      </div>
    </article>
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
        enqueueSnackbar(t("nui_menu.player_modal.history.revoked_success"), { variant: "success" });
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

  if (!history.length) {
    return <div className="empty" role="status">{t("nui_menu.player_modal.history.empty")}</div>;
  }

  return (
    <div className="rows">
      {history.map((action) => {
        const requiredPermission = action.type === "ban" ? "players.ban" : "players.warn";
        return (
          <HistoryRow
            key={action.id}
            action={action}
            serverTime={details.serverTime}
            canRevoke={!action.revokedBy && userHasPerm(requiredPermission, permissions)}
            isRevoking={revokingId === action.id}
            onRevoke={() => void handleRevoke(action.id)}
          />
        );
      })}
    </div>
  );
};
