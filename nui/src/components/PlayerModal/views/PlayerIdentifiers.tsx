import React, { useMemo } from "react";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import type { PlayerModalViewProps } from "../PlayerModal.types";
import { copyToClipboard } from "@nui/src/utils/copyToClipboard";
import { Button, IconButton } from "@nui/src/components/ui/Button";
import { CopyIcon } from "@nui/src/components/ui/icons";

type IdentifierListProps = {
  emptyMessage: string;
  values: string[];
  onCopy: (value: string) => void;
};

const IdentifierList: React.FC<IdentifierListProps> = ({
  emptyMessage,
  onCopy,
  values,
}) => {
  const t = useTranslate();

  if (!values.length) {
    return <p className="text-muted">{emptyMessage}</p>;
  }

  //Identifiers are full-width monospace rows with a copy button.
  return (
    <div className="rows">
      {values.map((value) => (
        <div className="row row-copy" key={value}>
          <code>{value}</code>
          <IconButton
            label={t("nui_menu.player_modal.ids.copy_identifier")}
            icon={<CopyIcon />}
            onClick={() => onCopy(value)}
          />
        </div>
      ))}
    </div>
  );
};

export const PlayerIdentifiers: React.FC<PlayerModalViewProps> = ({ details }) => {
  const t = useTranslate();
  const { enqueueSnackbar } = useSnackbar();
  const player = details.player;
  const identifiersOnline = useMemo(
    () => Array.from(new Set(player.idsOnline ?? [])),
    [player.idsOnline]
  );
  const identifiersSaved = useMemo(
    () => Array.from(new Set(player.idsOffline ?? [])),
    [player.idsOffline]
  );
  const hardwareIds = useMemo(
    () => Array.from(new Set([...(player.hwidsOnline ?? []), ...(player.hwidsOffline ?? [])])),
    [player.hwidsOffline, player.hwidsOnline]
  );

  const copyValue = (value: string) => {
    copyToClipboard(value, true);
    enqueueSnackbar(t("nui_menu.common.copied"), { variant: "info" });
  };

  return (
    <div className="stack">
      <section>
        <h3 className="heading">{t("nui_menu.player_modal.ids.current_ids")}</h3>
        <IdentifierList
          values={identifiersOnline}
          emptyMessage={t("nui_menu.player_modal.ids.none_current")}
          onCopy={copyValue}
        />
      </section>

      <section>
        <h3 className="heading">{t("nui_menu.player_modal.ids.previous_ids")}</h3>
        <IdentifierList
          values={identifiersSaved}
          emptyMessage={t("nui_menu.player_modal.ids.none_previous")}
          onCopy={copyValue}
        />
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h3 className="heading" style={{ margin: 0 }}>{t("nui_menu.player_modal.ids.all_hwids")}</h3>
          {hardwareIds.length > 0 && (
            <Button small onClick={() => copyValue(hardwareIds.join("\n"))}>
              {t("nui_menu.player_modal.ids.copy_all")}
            </Button>
          )}
        </div>
        <IdentifierList
          values={hardwareIds}
          emptyMessage={t("nui_menu.player_modal.ids.none_hwids")}
          onCopy={copyValue}
        />
      </section>
    </div>
  );
};
