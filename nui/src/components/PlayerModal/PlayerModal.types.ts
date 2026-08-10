import type { PlayerModalSuccess } from "@shared/playerApiTypes";
import type { PlayerData } from "@nui/src/hooks/usePlayerListListener";

export type PlayerModalTab =
  | "actions"
  | "info"
  | "identifiers"
  | "history"
  | "ban";

export interface PlayerModalViewProps {
  details: PlayerModalSuccess;
  target: PlayerData;
  reload: () => void;
}

export const getPlayerActionPath = (
  action: string,
  target: PlayerData,
  details: PlayerModalSuccess
) => {
  const params = new URLSearchParams({
    mutex: "current",
    netid: String(target.id),
    sessionRef: details.player.sessionRef ?? "",
  });
  return `/player/${action}?${params.toString()}` as `/${string}`;
};
