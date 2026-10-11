import React, { memo } from "react";
import { useTranslate } from "react-polyglot";
import { useSetAssociatedPlayer } from "../../state/playerDetails.state";
import { formatDistance } from "../../utils/miscUtils";
import { PlayerData, VehicleStatus } from "../../hooks/usePlayerListListener";
import { useSetPlayerModalVisibility } from "../../state/playerModal.state";
import { Badge } from "../ui/Badge";

const activityKeys: Record<VehicleStatus, string> = {
  [VehicleStatus.Unknown]: "nui_menu.page_players.activity.unknown",
  [VehicleStatus.Walking]: "nui_menu.page_players.activity.walking",
  [VehicleStatus.Driving]: "nui_menu.page_players.activity.driving",
  [VehicleStatus.Boat]: "nui_menu.page_players.activity.boating",
  [VehicleStatus.Biking]: "nui_menu.page_players.activity.biking",
  [VehicleStatus.Flying]: "nui_menu.page_players.activity.flying",
};

//Health is a status, not usage: low is bad. The number is always shown next to it.
const healthClass = (health: number) => {
  if (health <= 20) return "meter-fill is-danger";
  if (health <= 60) return "meter-fill is-warning";
  return "meter-fill is-success";
};

/**
 * A player record: id, name, activity and distance, and health as a number with
 * a small bar. The whole row opens the player modal.
 */
const PlayerRow: React.FC<{ playerData: PlayerData }> = ({ playerData }) => {
  const setModalOpen = useSetPlayerModalVisibility();
  const setAssociatedPlayer = useSetAssociatedPlayer();
  const t = useTranslate();

  const handleClick = () => {
    setAssociatedPlayer(playerData);
    setModalOpen(true);
  };

  const hasHealth = playerData.health >= 0;
  const health = hasHealth ? Math.min(100, Math.max(0, playerData.health)) : 0;
  const activity = t(activityKeys[playerData.vType] ?? activityKeys[VehicleStatus.Unknown]);
  const distance = playerData.dist < 0 ? "?" : formatDistance(playerData.dist);

  return (
    <button
      type="button"
      className="player-row"
      onClick={handleClick}
      aria-label={`#${playerData.id} ${playerData.displayName}`}
    >
      <span className="player-id">{playerData.id}</span>
      <span style={{ minWidth: 0 }}>
        <span className="player-name">
          <span className="truncate" title={playerData.displayName}>{playerData.displayName}</span>
          {playerData.admin && <Badge>{t("nui_menu.page_players.card.admin")}</Badge>}
        </span>
        <span className="player-meta truncate" style={{ display: "block" }}>
          {activity} · {distance}
        </span>
      </span>
      <span
        className="player-health"
        title={t("nui_menu.page_players.card.health", { percentHealth: hasHealth ? health : "?" })}
      >
        <span>{hasHealth ? `${health}%` : "?"}</span>
        <span className="meter" aria-hidden="true">
          {hasHealth && <span className={healthClass(health)} style={{ display: "block", width: `${health}%` }} />}
        </span>
      </span>
    </button>
  );
};

export default memo(PlayerRow);
