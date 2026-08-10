import { useCallback, useEffect, useState } from "react";
import { useTranslate } from "react-polyglot";
import type { PlayerModalResp, PlayerModalSuccess } from "@shared/playerApiTypes";
import type { PlayerData } from "@nui/src/hooks/usePlayerListListener";
import { fetchWebPipe } from "@nui/src/utils/fetchWebPipe";
import { MockedPlayerDetails } from "@nui/src/utils/constants";
import { debugLog } from "@nui/src/utils/debugLog";

type PlayerModalLoadState =
  | { status: "idle"; targetId: null }
  | { status: "loading"; targetId: number; targetConnectionRef: string }
  | { status: "ready"; targetId: number; targetConnectionRef: string; details: PlayerModalSuccess }
  | { status: "error"; targetId: number; targetConnectionRef: string; message: string };

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
};

export const usePlayerModalData = (target: PlayerData | null) => {
  const t = useTranslate();
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<PlayerModalLoadState>(() =>
    target
      ? { status: "loading", targetId: target.id, targetConnectionRef: target.connectionRef }
      : { status: "idle", targetId: null }
  );

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!target) {
      setState({ status: "idle", targetId: null });
      return;
    }

    let active = true;
    const targetId = target.id;
    const targetConnectionRef = target.connectionRef;
    setState({ status: "loading", targetId, targetConnectionRef });

    const load = async () => {
      try {
        const result = await fetchWebPipe<PlayerModalResp>(
          `/player?mutex=current&netid=${targetId}&connectionRef=${encodeURIComponent(targetConnectionRef)}`,
          { mockData: MockedPlayerDetails }
        );

        debugLog("FetchWebPipe", result, "PlayerFetch");
        if (!active) return;

        if (!result || typeof result !== "object") {
          throw new Error(t("nui_menu.misc.unknown_error"));
        }
        if ("error" in result) {
          throw new Error(result.error);
        }
        if (!result.player?.isConnected) {
          throw new Error(t("nui_menu.player_modal.misc.disconnected"));
        }
        if (typeof result.player.sessionRef !== "string" || !result.player.sessionRef) {
          throw new Error(t("nui_menu.player_modal.misc.disconnected"));
        }

        setState({ status: "ready", targetId, targetConnectionRef, details: result });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          targetId,
          targetConnectionRef,
          message: getErrorMessage(error, t("nui_menu.misc.unknown_error")),
        });
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [reloadToken, t, target?.connectionRef, target?.id]);

  return { state, reload };
};
