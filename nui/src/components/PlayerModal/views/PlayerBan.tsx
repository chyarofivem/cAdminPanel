import React, { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  styled,
  TextField,
  Typography,
} from "@mui/material";
import { BlockRounded } from "@mui/icons-material";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import type { GenericApiResp } from "@shared/genericApiTypes";
import type { BanDurationType, BanTemplatesDataType } from "@shared/otherTypes";
import { getPlayerActionPath, type PlayerModalViewProps } from "../PlayerModal.types";
import { usePermissionsValue } from "@nui/src/state/permissions.state";
import { useSetPlayerModalVisibility } from "@nui/src/state/playerModal.state";
import { fetchWebPipe } from "@nui/src/utils/fetchWebPipe";
import { userHasPerm } from "@nui/src/utils/miscUtils";
import { nuiTokens } from "@nui/src/styles/nuiTokens";

type DurationValue =
  | "2 hours"
  | "8 hours"
  | "1 day"
  | "2 days"
  | "1 week"
  | "2 weeks"
  | "permanent"
  | "custom";
type DurationUnit = "hours" | "days" | "weeks" | "months";
type TemplateOption = { id: string; label: string };

const defaultDurations: DurationValue[] = [
  "2 hours",
  "8 hours",
  "1 day",
  "2 days",
  "1 week",
  "2 weeks",
  "permanent",
];

const durationToString = (duration: BanDurationType) => {
  if (duration === "permanent") return duration;
  const unit = duration.value === 1 ? duration.unit.slice(0, -1) : duration.unit;
  return `${duration.value} ${unit}`;
};

const durationToShortString = (duration: BanDurationType) => {
  if (duration === "permanent") return "PERM";
  const suffixes: Record<DurationUnit, string> = {
    hours: "h",
    days: "d",
    weeks: "w",
    months: "mo",
  };
  return `${duration.value}${suffixes[duration.unit]}`;
};

const ViewRoot = styled(Box)({
  width: "100%",
  height: "100%",
  overflow: "auto",
  padding: 24,
});

const FormCard = styled("form")({
  width: "min(620px, 100%)",
  padding: 20,
  borderRadius: nuiTokens.radiusSm,
  backgroundColor: "rgba(255,255,255,0.035)",
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
});

export const PlayerBan: React.FC<PlayerModalViewProps> = ({ details, target }) => {
  const t = useTranslate();
  const { enqueueSnackbar } = useSnackbar();
  const permissions = usePermissionsValue();
  const setModalOpen = useSetPlayerModalVisibility();
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<DurationValue>("2 hours");
  const [customLength, setCustomLength] = useState("1");
  const [customUnit, setCustomUnit] = useState<DurationUnit>("hours");
  const [submitting, setSubmitting] = useState(false);
  const templates = details.banTemplates ?? [];

  const templateOptions = useMemo<TemplateOption[]>(
    () => templates.map((template) => ({ id: template.id, label: template.reason })),
    [templates]
  );

  const applyTemplate = (template: BanTemplatesDataType) => {
    setReason(template.reason);
    const processedDuration = durationToString(template.duration);
    if (defaultDurations.includes(processedDuration as DurationValue)) {
      setDuration(processedDuration as DurationValue);
      return;
    }
    if (template.duration !== "permanent") {
      setDuration("custom");
      setCustomLength(String(template.duration.value));
      setCustomUnit(template.duration.unit);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userHasPerm("players.ban", permissions)) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      enqueueSnackbar(t("nui_menu.player_modal.ban.reason_required"), {
        variant: "error",
      });
      return;
    }

    const numericCustomLength = Number(customLength);
    if (
      duration === "custom" &&
      (!Number.isFinite(numericCustomLength) || numericCustomLength <= 0)
    ) {
      enqueueSnackbar(t("nui_menu.player_modal.ban.duration_required"), {
        variant: "error",
      });
      return;
    }

    const actualDuration =
      duration === "custom" ? `${numericCustomLength} ${customUnit}` : duration;
    setSubmitting(true);
    try {
      const result = await fetchWebPipe<GenericApiResp>(
        getPlayerActionPath("ban", target, details),
        {
          method: "POST",
          data: { reason: trimmedReason, duration: actualDuration },
        }
      );
      if ("success" in result && result.success) {
        enqueueSnackbar(t("nui_menu.player_modal.ban.success"), {
          variant: "success",
        });
        setModalOpen(false);
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
      setSubmitting(false);
    }
  };

  const durationOptions: Array<{ value: DurationValue; label: string }> = [
    { value: "2 hours", label: `2 ${t("nui_menu.player_modal.ban.hours")}` },
    { value: "8 hours", label: `8 ${t("nui_menu.player_modal.ban.hours")}` },
    { value: "1 day", label: `1 ${t("nui_menu.player_modal.ban.days")}` },
    { value: "2 days", label: `2 ${t("nui_menu.player_modal.ban.days")}` },
    { value: "1 week", label: `1 ${t("nui_menu.player_modal.ban.weeks")}` },
    { value: "2 weeks", label: `2 ${t("nui_menu.player_modal.ban.weeks")}` },
    { value: "permanent", label: t("nui_menu.player_modal.ban.permanent") },
    { value: "custom", label: t("nui_menu.player_modal.ban.custom") },
  ];
  const unitOptions: Array<{ value: DurationUnit; label: string }> = [
    { value: "hours", label: t("nui_menu.player_modal.ban.hours") },
    { value: "days", label: t("nui_menu.player_modal.ban.days") },
    { value: "weeks", label: t("nui_menu.player_modal.ban.weeks") },
    { value: "months", label: t("nui_menu.player_modal.ban.months") },
  ];

  return (
    <ViewRoot>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 780 }}>
        {t("nui_menu.player_modal.ban.title")}
      </Typography>

      <FormCard onSubmit={handleSubmit}>
        <Autocomplete<TemplateOption, false, false, true>
          freeSolo
          options={templateOptions}
          inputValue={reason}
          onInputChange={(_event, value) => setReason(value)}
          onChange={(_event, value, changeReason) => {
            if (changeReason !== "selectOption" || typeof value === "string" || !value) {
              return;
            }
            const template = templates.find((item) => item.id === value.id);
            if (template) applyTemplate(template);
          }}
          getOptionLabel={(option) =>
            typeof option === "string" ? option : option.label
          }
          renderOption={(props, option) => {
            const template = templates.find((item) => item.id === option.id);
            const { key, ...optionProps } = props;
            return (
              <li key={key ?? option.id} {...optionProps}>
                <Typography
                  component="span"
                  sx={{ mr: 1, minWidth: 40, fontFamily: "monospace", opacity: 0.72 }}
                >
                  {template ? durationToShortString(template.duration) : "?"}
                </Typography>
                <Typography component="span" noWrap>
                  {option.label}
                </Typography>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              label={t("nui_menu.player_modal.ban.reason_placeholder")}
              inputProps={{ ...params.inputProps, maxLength: 2048 }}
            />
          )}
        />

        <TextField
          select
          required
          fullWidth
          sx={{ mt: 2 }}
          label={t("nui_menu.player_modal.ban.duration_placeholder")}
          value={duration}
          helperText={t("nui_menu.player_modal.ban.helper_text")}
          onChange={(event) => setDuration(event.target.value as DurationValue)}
        >
          {durationOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        {duration === "custom" && (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 1, mt: 1 }}>
            <TextField
              required
              type="number"
              value={customLength}
              inputProps={{ min: 1, step: 1 }}
              onChange={(event) => setCustomLength(event.target.value)}
            />
            <TextField
              select
              value={customUnit}
              onChange={(event) => setCustomUnit(event.target.value as DurationUnit)}
            >
              {unitOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        )}

        <Button
          type="submit"
          color="error"
          variant="contained"
          sx={{ mt: 2 }}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} /> : <BlockRounded />}
        >
          {t("nui_menu.player_modal.ban.submit")}
        </Button>
      </FormCard>
    </ViewRoot>
  );
};
