import React, { useEffect, useMemo, useState } from "react";
import humanizeDuration, { type Unit } from "humanize-duration";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import type { GenericApiResp } from "@shared/genericApiTypes";
import { getPlayerActionPath, type PlayerModalViewProps } from "../PlayerModal.types";
import { usePermissionsValue } from "@nui/src/state/permissions.state";
import { fetchWebPipe } from "@nui/src/utils/fetchWebPipe";
import { tsToLocaleDate, userHasPerm } from "@nui/src/utils/miscUtils";
import { Button } from "@nui/src/components/ui/Button";

type PlayerOverviewProps = PlayerModalViewProps & {
  onShowHistory: () => void;
};

export const PlayerOverview: React.FC<PlayerOverviewProps> = ({
  details,
  onShowHistory,
  reload,
  target,
}) => {
  const t = useTranslate();
  const { enqueueSnackbar } = useSnackbar();
  const permissions = usePermissionsValue();
  const player = details.player;
  const [note, setNote] = useState(player.notes ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [changingAllowlist, setChangingAllowlist] = useState(false);

  useEffect(() => {
    setNote(player.notes ?? "");
  }, [player.notes, target.id]);

  const historyCounts = useMemo(() => {
    const counts = { ban: 0, warn: 0 };
    for (const action of player.actionHistory) counts[action.type] += 1;
    return counts;
  }, [player.actionHistory]);

  const formatMinutes = (minutes?: number) => {
    if (typeof minutes !== "number") return t("nui_menu.player_modal.misc.no_value");
    return humanizeDuration(minutes * 60_000, {
      language: t("$meta.humanizer_language"),
      round: true,
      units: ["d", "h", "m"] as Unit[],
      fallbacks: ["en"],
    });
  };

  const showApiError = (result: GenericApiResp) => {
    enqueueSnackbar(
      "error" in result ? result.error : t("nui_menu.misc.unknown_error"),
      { variant: "error" }
    );
  };

  const handleAllowlistChange = async () => {
    if (!userHasPerm("players.whitelist", permissions) || !player.license) return;
    setChangingAllowlist(true);
    try {
      const result = await fetchWebPipe<GenericApiResp>(
        getPlayerActionPath("whitelist", target, details),
        {
          method: "POST",
          data: { status: !player.tsWhitelisted },
        }
      );
      if ("success" in result && result.success) {
        enqueueSnackbar(t("nui_menu.player_modal.info.btn_wl_success"), {
          variant: "success",
        });
        reload();
      } else {
        showApiError(result);
      }
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : t("nui_menu.misc.unknown_error"),
        { variant: "error" }
      );
    } finally {
      setChangingAllowlist(false);
    }
  };

  const handleSaveNote = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingNote(true);
    try {
      const result = await fetchWebPipe<GenericApiResp>(
        getPlayerActionPath("save_note", target, details),
        {
          method: "POST",
          data: { note: note.trim() },
        }
      );
      if ("success" in result && result.success) {
        enqueueSnackbar(t("nui_menu.player_modal.info.notes_changed"), {
          variant: "success",
        });
        reload();
      } else {
        showApiError(result);
      }
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : t("nui_menu.misc.unknown_error"),
        { variant: "error" }
      );
    } finally {
      setSavingNote(false);
    }
  };

  const stats = [
    {
      label: t("nui_menu.player_modal.info.session_time"),
      value: formatMinutes(player.sessionTime),
    },
    {
      label: t("nui_menu.player_modal.info.play_time"),
      value: formatMinutes(player.playTime),
    },
    {
      label: t("nui_menu.player_modal.info.joined"),
      value: player.tsJoined
        ? tsToLocaleDate(player.tsJoined, "medium")
        : t("nui_menu.player_modal.misc.no_value"),
    },
    {
      label: t("nui_menu.player_modal.info.whitelisted_label"),
      value: player.tsWhitelisted
        ? tsToLocaleDate(player.tsWhitelisted, "medium")
        : t("nui_menu.player_modal.info.whitelisted_notyet"),
    },
  ];

  const canChangeAllowlist = userHasPerm("players.whitelist", permissions) && Boolean(player.license);
  const noteUnchanged = note.trim() === (player.notes ?? "");

  return (
    <div className="stack">
      <div className="stat-rows">
        {stats.map(({ label, value }) => (
          <div className="stat" key={label}>
            <p className="stat-label">{label}</p>
            <p className="stat-value truncate" title={value}>{value}</p>
          </div>
        ))}
      </div>

      <form className="field" onSubmit={handleSaveNote}>
        <label className="field-label" htmlFor="player-notes">
          {t("nui_menu.player_modal.info.notes_title")}
        </label>
        <textarea
          id="player-notes"
          className="textarea"
          rows={4}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("nui_menu.player_modal.info.notes_placeholder")}
        />
        {player.notesLog && <p className="field-help">{player.notesLog}</p>}
        <div>
          <Button type="submit" variant="primary" disabled={savingNote || noteUnchanged}>
            {t("nui_menu.player_modal.info.save_note")}
          </Button>
        </div>
      </form>

      <div className="rows">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <p className="text-white">{t("nui_menu.player_modal.info.whitelisted_label")}</p>
            <p className="text-dense text-muted">
              {player.tsWhitelisted
                ? t("nui_menu.player_modal.info.allowlist_active")
                : t("nui_menu.player_modal.info.allowlist_inactive")}
            </p>
          </div>
          <Button
            small
            destructive={Boolean(player.tsWhitelisted)}
            disabled={changingAllowlist || !canChangeAllowlist}
            onClick={() => void handleAllowlistChange()}
          >
            {player.tsWhitelisted
              ? t("nui_menu.player_modal.info.btn_wl_remove")
              : t("nui_menu.player_modal.info.btn_wl_add")}
          </Button>
        </div>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <p className="text-white">{t("nui_menu.player_modal.info.log_label")}</p>
            <p className="text-dense text-muted tabular">
              {t("nui_menu.player_modal.info.log_ban_count", { smart_count: historyCounts.ban })}
              {", "}
              {t("nui_menu.player_modal.info.log_warn_count", { smart_count: historyCounts.warn })}
            </p>
          </div>
          <Button small onClick={onShowHistory}>
            {t("nui_menu.player_modal.info.log_btn")}
          </Button>
        </div>
      </div>
    </div>
  );
};
