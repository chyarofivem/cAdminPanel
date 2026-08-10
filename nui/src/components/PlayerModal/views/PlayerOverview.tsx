import React, { useEffect, useMemo, useState } from "react";
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  styled,
  TextField,
  Typography,
} from "@mui/material";
import {
  AccessTimeRounded,
  EventRounded,
  FactCheckRounded,
  HistoryRounded,
} from "@mui/icons-material";
import humanizeDuration, { type Unit } from "humanize-duration";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import type { GenericApiResp } from "@shared/genericApiTypes";
import { getPlayerActionPath, type PlayerModalViewProps } from "../PlayerModal.types";
import { usePermissionsValue } from "@nui/src/state/permissions.state";
import { fetchWebPipe } from "@nui/src/utils/fetchWebPipe";
import { tsToLocaleDate, userHasPerm } from "@nui/src/utils/miscUtils";
import { nuiTokens } from "@nui/src/styles/nuiTokens";

type PlayerOverviewProps = PlayerModalViewProps & {
  onShowHistory: () => void;
};

const ViewRoot = styled(Box)({
  width: "100%",
  height: "100%",
  overflow: "auto",
  padding: 24,
});

const StatGrid = styled(Box)({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
  "@media (max-width: 800px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
});

const StatCard = styled(Box)(({ theme }) => ({
  minWidth: 0,
  padding: 14,
  borderRadius: nuiTokens.radiusSm,
  backgroundColor: "rgba(255,255,255,0.04)",
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
  "& svg": {
    color: theme.palette.primary.main,
    fontSize: 19,
  },
}));

const ContentCard = styled(Box)({
  padding: 18,
  borderRadius: nuiTokens.radiusSm,
  backgroundColor: "rgba(255,255,255,0.035)",
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
});

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
      Icon: AccessTimeRounded,
    },
    {
      label: t("nui_menu.player_modal.info.play_time"),
      value: formatMinutes(player.playTime),
      Icon: HistoryRounded,
    },
    {
      label: t("nui_menu.player_modal.info.joined"),
      value: player.tsJoined
        ? tsToLocaleDate(player.tsJoined, "medium")
        : t("nui_menu.player_modal.misc.no_value"),
      Icon: EventRounded,
    },
    {
      label: t("nui_menu.player_modal.info.whitelisted_label"),
      value: player.tsWhitelisted
        ? tsToLocaleDate(player.tsWhitelisted, "medium")
        : t("nui_menu.player_modal.info.whitelisted_notyet"),
      Icon: FactCheckRounded,
    },
  ];

  return (
    <ViewRoot>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 780 }}>
        {t("nui_menu.player_modal.info.title")}
      </Typography>

      <StatGrid>
        {stats.map(({ Icon, label, value }) => (
          <StatCard key={label}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Icon />
              <Typography
                color="text.secondary"
                sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.03em" }}
              >
                {label}
              </Typography>
            </Box>
            <Typography
              title={value}
              sx={{ mt: 1, overflow: "hidden", fontSize: 14, fontWeight: 750, textOverflow: "ellipsis" }}
              noWrap
            >
              {value}
            </Typography>
          </StatCard>
        ))}
      </StatGrid>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(240px, 0.6fr)",
          gap: 2,
          mt: 2,
          "@media (max-width: 760px)": { gridTemplateColumns: "1fr" },
        }}
      >
        <ContentCard>
          <Box component="form" onSubmit={handleSaveNote}>
            <Typography sx={{ fontSize: 15, fontWeight: 760 }}>
              {t("nui_menu.player_modal.info.notes_title")}
            </Typography>
            {player.notesLog && (
              <Typography color="text.secondary" sx={{ mt: 0.25, fontSize: 11.5 }}>
                {player.notesLog}
              </Typography>
            )}
            <TextField
              fullWidth
              multiline
              minRows={4}
              maxRows={7}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("nui_menu.player_modal.info.notes_placeholder")}
              sx={{
                mt: 1.5,
                "& .MuiOutlinedInput-root": {
                  alignItems: "flex-start",
                  bgcolor: "rgba(0,0,0,0.16)",
                },
              }}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.25 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={savingNote || note.trim() === (player.notes ?? "")}
                startIcon={savingNote ? <CircularProgress size={16} /> : undefined}
              >
                {t("nui_menu.player_modal.info.save_note")}
              </Button>
            </Box>
          </Box>
        </ContentCard>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <ContentCard>
            <Typography sx={{ fontSize: 15, fontWeight: 760 }}>
              {t("nui_menu.player_modal.info.whitelisted_label")}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
              {player.tsWhitelisted
                ? t("nui_menu.player_modal.info.allowlist_active")
                : t("nui_menu.player_modal.info.allowlist_inactive")}
            </Typography>
            <Button
              fullWidth
              sx={{ mt: 1.5 }}
              color={player.tsWhitelisted ? "error" : "primary"}
              variant="outlined"
              disabled={
                changingAllowlist ||
                !player.license ||
                !userHasPerm("players.whitelist", permissions)
              }
              startIcon={changingAllowlist ? <CircularProgress size={16} /> : undefined}
              onClick={() => void handleAllowlistChange()}
            >
              {player.tsWhitelisted
                ? t("nui_menu.player_modal.info.btn_wl_remove")
                : t("nui_menu.player_modal.info.btn_wl_add")}
            </Button>
          </ContentCard>

          <ContentCard>
            <Typography sx={{ fontSize: 15, fontWeight: 760 }}>
              {t("nui_menu.player_modal.info.log_label")}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 13 }}>
              {t("nui_menu.player_modal.info.log_ban_count", {
                smart_count: historyCounts.ban,
              })}
              {", "}
              {t("nui_menu.player_modal.info.log_warn_count", {
                smart_count: historyCounts.warn,
              })}
            </Typography>
            <Button fullWidth sx={{ mt: 1.5 }} variant="outlined" onClick={onShowHistory}>
              {t("nui_menu.player_modal.info.log_btn")}
            </Button>
          </ContentCard>
        </Box>
      </Box>
    </ViewRoot>
  );
};
