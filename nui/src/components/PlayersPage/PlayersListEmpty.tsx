import React from "react";
import { alpha, Box, styled, Typography } from "@mui/material";
import { PersonSearchRounded } from "@mui/icons-material";
import { useTranslate } from "react-polyglot";
import { nuiTokens } from "@nui/src/styles/nuiTokens";

const EmptyRoot = styled(Box)(({ theme }) => ({
  display: "flex",
  flex: 1,
  minHeight: 180,
  margin: 18,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  borderRadius: nuiTokens.radiusSm,
  color: theme.palette.text.secondary,
  backgroundColor: "rgba(0,0,0,0.12)",
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
}));

const EmptyIcon = styled(Box)(({ theme }) => ({
  display: "grid",
  width: 52,
  height: 52,
  placeItems: "center",
  borderRadius: 999,
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
  "& svg": { fontSize: 26 },
}));

export const PlayersListEmpty: React.FC = () => {
  const t = useTranslate();

  return (
    <EmptyRoot role="status">
      <EmptyIcon aria-hidden="true">
        <PersonSearchRounded />
      </EmptyIcon>
      <Typography sx={{ fontSize: 14, fontWeight: 650 }} color="inherit">
        {t("nui_menu.page_players.misc.zero_players")}
      </Typography>
    </EmptyRoot>
  );
};
