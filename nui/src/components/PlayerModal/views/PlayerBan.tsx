import React, { useMemo, useState } from "react";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import type { GenericApiResp } from "@shared/genericApiTypes";
import type { BanDurationType, BanTemplatesDataType } from "@shared/otherTypes";
import { getPlayerActionPath, type PlayerModalViewProps } from "../PlayerModal.types";
import { usePermissionsValue } from "@nui/src/state/permissions.state";
import { useSetPlayerModalVisibility } from "@nui/src/state/playerModal.state";
import { fetchWebPipe } from "@nui/src/utils/fetchWebPipe";
import { userHasPerm } from "@nui/src/utils/miscUtils";
import { Button } from "@nui/src/components/ui/Button";
import { Select } from "@nui/src/components/ui/Select";

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

type PendingBan = {
  reason: string;
  duration: string;
  durationLabel: string;
};

/**
 * The ban form: reason, ban templates, duration, then a confirmation step.
 * Filled red appears only on that confirmation's confirm button.
 */
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
  const [pendingBan, setPendingBan] = useState<PendingBan | null>(null);
  const templates = details.banTemplates ?? [];

  const matchingTemplates = useMemo(() => {
    const query = reason.trim().toLowerCase();
    const list = query
      ? templates.filter((template) => template.reason.toLowerCase().includes(query))
      : templates;
    return list.slice(0, 6);
  }, [reason, templates]);

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

  const applyTemplate = (template: BanTemplatesDataType) => {
    setPendingBan(null);
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

  //Validates the form, then asks for confirmation.
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!userHasPerm("players.ban", permissions)) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      enqueueSnackbar(t("nui_menu.player_modal.ban.reason_required"), { variant: "error" });
      return;
    }

    const numericCustomLength = Number(customLength);
    if (
      duration === "custom" &&
      (!Number.isFinite(numericCustomLength) || numericCustomLength <= 0)
    ) {
      enqueueSnackbar(t("nui_menu.player_modal.ban.duration_required"), { variant: "error" });
      return;
    }

    const isCustom = duration === "custom";
    setPendingBan({
      reason: trimmedReason,
      duration: isCustom ? `${numericCustomLength} ${customUnit}` : duration,
      durationLabel: isCustom
        ? `${numericCustomLength} ${unitOptions.find((option) => option.value === customUnit)?.label ?? customUnit}`
        : durationOptions.find((option) => option.value === duration)?.label ?? duration,
    });
  };

  const confirmBan = async () => {
    if (!pendingBan) return;
    setSubmitting(true);
    try {
      const result = await fetchWebPipe<GenericApiResp>(
        getPlayerActionPath("ban", target, details),
        {
          method: "POST",
          data: { reason: pendingBan.reason, duration: pendingBan.duration },
        }
      );
      if ("success" in result && result.success) {
        enqueueSnackbar(t("nui_menu.player_modal.ban.success"), { variant: "success" });
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
      setPendingBan(null);
    }
  };

  return (
    <form className="stack" style={{ maxWidth: 640 }} onSubmit={handleSubmit}>
      <div className="field">
        <label className="field-label" htmlFor="ban-reason">
          {t("nui_menu.player_modal.ban.reason_placeholder")}
        </label>
        <input
          id="ban-reason"
          className="input"
          autoFocus
          autoComplete="off"
          maxLength={2048}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setPendingBan(null);
          }}
        />
      </div>

      {matchingTemplates.length > 0 && (
        <section>
          <h3 className="heading">{t("nui_menu.player_modal.ban.templates")}</h3>
          <div className="rows">
            {matchingTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="template-row"
                onClick={() => applyTemplate(template)}
              >
                <span className="template-duration">{durationToShortString(template.duration)}</span>
                <span className="truncate">{template.reason}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="field">
        <label className="field-label" htmlFor="ban-duration">
          {t("nui_menu.player_modal.ban.duration_placeholder")}
        </label>
        <Select<DurationValue>
          id="ban-duration"
          value={duration}
          options={durationOptions}
          onChange={(value) => {
            setDuration(value);
            setPendingBan(null);
          }}
        />
        {duration === "custom" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8 }}>
            <input
              className="input"
              type="number"
              min={1}
              step={1}
              aria-label={t("nui_menu.player_modal.ban.duration_placeholder")}
              value={customLength}
              onChange={(event) => {
                setCustomLength(event.target.value);
                setPendingBan(null);
              }}
            />
            <Select<DurationUnit>
              aria-label={t("nui_menu.player_modal.ban.custom")}
              value={customUnit}
              options={unitOptions}
              onChange={(value) => {
                setCustomUnit(value);
                setPendingBan(null);
              }}
            />
          </div>
        )}
      </div>

      {pendingBan ? (
        <div className="callout callout-danger" role="alertdialog" aria-labelledby="ban-confirm-title">
          <p id="ban-confirm-title" className="callout-title">
            {t("nui_menu.player_modal.ban.confirm_title", {
              name: details.player.displayName,
              duration: pendingBan.durationLabel,
            })}
          </p>
          <p style={{ overflowWrap: "anywhere" }}>{pendingBan.reason}</p>
          <div className="modal-footer" style={{ padding: "16px 0 0" }}>
            <Button onClick={() => setPendingBan(null)} disabled={submitting}>
              {t("nui_menu.common.cancel")}
            </Button>
            <Button variant="danger" onClick={() => void confirmBan()} disabled={submitting}>
              {t("nui_menu.player_modal.ban.submit")}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button type="submit" destructive>
            {t("nui_menu.player_modal.ban.review")}
          </Button>
        </div>
      )}
    </form>
  );
};
