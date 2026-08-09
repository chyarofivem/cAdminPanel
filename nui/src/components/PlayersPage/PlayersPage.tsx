import React from "react";
import { alpha, Box, styled } from "@mui/material";
import { PlayerPageHeader } from "./PlayerPageHeader";
import { useFilteredSortedPlayers } from "../../state/players.state";
import { PlayersListEmpty } from "./PlayersListEmpty";
import { PlayersListGrid } from "./PlayersListGrid";
import { usePlayerListListener } from "../../hooks/usePlayerListListener";
import { nuiTokens } from "@nui/src/styles/nuiTokens";
import { useTranslate } from "react-polyglot";

const PlayersShell = styled("section")(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  width: "100%",
  marginTop: 14,
  borderRadius: nuiTokens.radius,
  color: theme.palette.text.primary,
  background: `linear-gradient(145deg, ${alpha(
    theme.palette.background.paper,
    0.98
  )} 0%, ${theme.palette.background.default} 72%)`,
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}, 0 24px 70px rgba(0,0,0,0.48)`,
  overflow: "hidden",
}));

const DirectoryBody = styled(Box)({
  display: "flex",
  flex: 1,
  minHeight: 0,
  flexDirection: "column",
});

export const PlayersPage: React.FC<{ visible: boolean }> = ({ visible }) => {
  const players = useFilteredSortedPlayers();
  const t = useTranslate();

  usePlayerListListener();

  return (
    <PlayersShell
      aria-label={t("nui_menu.page_players.misc.online_players")}
      aria-hidden={!visible}
      style={{ display: visible ? "flex" : "none", flexDirection: "column" }}
    >
      <PlayerPageHeader visiblePlayerCount={players.length} />
      <DirectoryBody>
        {players.length ? <PlayersListGrid /> : <PlayersListEmpty />}
      </DirectoryBody>
    </PlayersShell>
  );
};
