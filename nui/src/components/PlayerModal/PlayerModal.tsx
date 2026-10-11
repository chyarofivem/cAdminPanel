import React, { useEffect, useState } from "react";
import { useTranslate } from "react-polyglot";
import { useAssociatedPlayerValue } from "@nui/src/state/playerDetails.state";
import { usePermissionsValue } from "@nui/src/state/permissions.state";
import { usePlayersState } from "@nui/src/state/players.state";
import { userHasPerm } from "@nui/src/utils/miscUtils";
import type { PlayerModalTab } from "./PlayerModal.types";
import { usePlayerModalData } from "./usePlayerModalData";
import { PlayerActions } from "./views/PlayerActions";
import { PlayerOverview } from "./views/PlayerOverview";
import { PlayerIdentifiers } from "./views/PlayerIdentifiers";
import { PlayerHistory } from "./views/PlayerHistory";
import { PlayerBan } from "./views/PlayerBan";
import { Badge } from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { CloseIcon, RefreshIcon } from "../ui/icons";

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

/**
 * Loading, disconnected and error states: a heading, one line, and at most one
 * primary action. No illustration.
 */
const StatusView: React.FC<StatusViewProps> = ({ error, message, onClose, onRetry, title }) => {
  const t = useTranslate();
  return (
    <div className="status-view" role={error ? "alert" : "status"}>
      <h2 className="section-title">{title}</h2>
      <p className="text-muted" style={{ maxWidth: 520, overflowWrap: "anywhere" }}>{message}</p>
      {(onRetry || onClose) && (
        <div className="chips">
          {onRetry && <Button variant="primary" onClick={onRetry}>{t("nui_menu.player_modal.misc.retry")}</Button>}
          {onClose && <Button onClick={onClose}>{t("nui_menu.player_modal.misc.close")}</Button>}
        </div>
      )}
    </div>
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

  const tabs: Array<{ value: PlayerModalTab; label: string; disabled?: boolean }> = [
    { value: "actions", label: t("nui_menu.player_modal.tabs.actions") },
    { value: "info", label: t("nui_menu.player_modal.tabs.info") },
    { value: "identifiers", label: t("nui_menu.player_modal.tabs.ids") },
    { value: "history", label: t("nui_menu.player_modal.tabs.history") },
    { value: "ban", label: t("nui_menu.player_modal.tabs.ban"), disabled: !canBan },
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
        return <PlayerOverview {...viewProps} onShowHistory={() => setTab("history")} />;
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
    <>
      <header className="pm-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 id="player-modal-title" className="pm-name truncate" title={displayName}>
            {displayName ?? t("nui_menu.player_modal.misc.unavailable")}
          </h2>
          <div className="pm-meta">
            {target && <span className="mono tabular">#{target.id}</span>}
            {readyState && (readyState.details.player.isRegistered
              ? <Badge variant="success">{t("nui_menu.player_modal.misc.registered")}</Badge>
              : <Badge>{t("nui_menu.player_modal.misc.unregistered")}</Badge>)}
          </div>
        </div>
        {target && (
          <IconButton
            label={t("nui_menu.player_modal.misc.refresh")}
            icon={<RefreshIcon />}
            disabled={!targetIsCurrent || state.status === "loading"}
            onClick={reload}
          />
        )}
        <IconButton
          label={t("nui_menu.player_modal.misc.close")}
          icon={<CloseIcon />}
          onClick={onClose}
        />
      </header>

      <nav className="pm-tabs" aria-label={t("nui_menu.player_modal.misc.navigation")}>
        <div className="tabs-underline" role="tablist">
          {tabs.map(({ disabled, label, value }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? "tab-underline is-active" : "tab-underline"}
              disabled={disabled || !readyState}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="modal-body" style={{ display: "flex", flexDirection: "column" }}>
        {renderContent()}
      </div>
    </>
  );
};

export default PlayerModal;
