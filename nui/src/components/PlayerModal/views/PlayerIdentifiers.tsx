import React, { useMemo } from "react";
import {
  Box,
  Button,
  IconButton,
  styled,
  Tooltip,
  Typography,
} from "@mui/material";
import { ContentCopyRounded, CopyAllRounded } from "@mui/icons-material";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import type { PlayerModalViewProps } from "../PlayerModal.types";
import { copyToClipboard } from "@nui/src/utils/copyToClipboard";
import { nuiTokens } from "@nui/src/styles/nuiTokens";

const ViewRoot = styled(Box)({
  width: "100%",
  height: "100%",
  overflow: "auto",
  padding: 24,
});

const IdentifierSection = styled(Box)({
  padding: 18,
  borderRadius: nuiTokens.radiusSm,
  backgroundColor: "rgba(255,255,255,0.035)",
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
  "& + &": { marginTop: 14 },
});

const IdentifierRow = styled(Box)({
  display: "flex",
  minWidth: 0,
  alignItems: "center",
  gap: 10,
  padding: "8px 8px 8px 12px",
  borderRadius: nuiTokens.radiusXs,
  backgroundColor: "rgba(0,0,0,0.18)",
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
  "& + &": { marginTop: 7 },
});

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
    return (
      <Typography color="text.secondary" sx={{ mt: 1.25, fontSize: 13 }}>
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 1.25 }}>
      {values.map((value) => (
        <IdentifierRow key={value}>
          <Typography
            component="code"
            sx={{
              flex: 1,
              minWidth: 0,
              color: "text.secondary",
              fontFamily: "monospace",
              fontSize: 12.5,
              overflowWrap: "anywhere",
            }}
          >
            {value}
          </Typography>
          <Tooltip title={t("nui_menu.player_modal.ids.copy_identifier")} arrow>
            <IconButton
              size="small"
              aria-label={t("nui_menu.player_modal.ids.copy_identifier")}
              onClick={() => onCopy(value)}
            >
              <ContentCopyRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        </IdentifierRow>
      ))}
    </Box>
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
    <ViewRoot>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 780 }}>
        {t("nui_menu.player_modal.tabs.ids")}
      </Typography>

      <IdentifierSection>
        <Typography sx={{ fontSize: 15, fontWeight: 760 }}>
          {t("nui_menu.player_modal.ids.current_ids")}
        </Typography>
        <IdentifierList
          values={identifiersOnline}
          emptyMessage={t("nui_menu.player_modal.ids.none_current")}
          onCopy={copyValue}
        />
      </IdentifierSection>

      <IdentifierSection>
        <Typography sx={{ fontSize: 15, fontWeight: 760 }}>
          {t("nui_menu.player_modal.ids.previous_ids")}
        </Typography>
        <IdentifierList
          values={identifiersSaved}
          emptyMessage={t("nui_menu.player_modal.ids.none_previous")}
          onCopy={copyValue}
        />
      </IdentifierSection>

      <IdentifierSection>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ flex: 1, fontSize: 15, fontWeight: 760 }}>
            {t("nui_menu.player_modal.ids.all_hwids")}
          </Typography>
          {hardwareIds.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<CopyAllRounded />}
              onClick={() => copyValue(hardwareIds.join("\n"))}
            >
              {t("nui_menu.player_modal.ids.copy_all")}
            </Button>
          )}
        </Box>
        <IdentifierList
          values={hardwareIds}
          emptyMessage={t("nui_menu.player_modal.ids.none_hwids")}
          onCopy={copyValue}
        />
      </IdentifierSection>
    </ViewRoot>
  );
};
