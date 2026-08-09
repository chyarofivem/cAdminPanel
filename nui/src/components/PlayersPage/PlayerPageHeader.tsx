import React, { useEffect, useMemo, useState } from "react";
import {
  alpha,
  Box,
  InputAdornment,
  MenuItem,
  styled,
  Typography,
} from "@mui/material";
import {
  DirectionsCarRounded,
  FavoriteRounded,
  FilterAltRounded,
  GroupsRounded,
  SearchRounded,
  SecurityRounded,
  SwapVertRounded,
  WifiOffRounded,
  WifiRounded,
} from "@mui/icons-material";
import {
  PlayerDataFilter,
  PlayerDataSort,
  usePlayersFilterBy,
  usePlayersSortBy,
  usePlayersState,
  usePlayersSearch,
  useSetPlayersFilterIsTemp,
} from "../../state/players.state";
import { useServerCtxValue } from "../../state/server.state";
import { useTranslate } from "react-polyglot";
import { TextField } from "../misc/TextField";
import { useDebounce } from "@nui/src/hooks/useDebouce";
import { VehicleStatus } from "@nui/src/hooks/usePlayerListListener";
import { microLabel, nuiTokens } from "@nui/src/styles/nuiTokens";

const HeaderRoot = styled(Box)({
  flexShrink: 0,
  padding: "18px 20px 16px",
  borderBottom: nuiTokens.dashedBorder,
});

const HeaderSummary = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 14,
});

const DirectoryIcon = styled(Box)(({ theme }) => ({
  display: "grid",
  flexShrink: 0,
  width: 44,
  height: 44,
  placeItems: "center",
  borderRadius: nuiTokens.radiusSm,
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.14),
  boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`,
  "& svg": { fontSize: 23 },
}));

const CountPill = styled(Box)(({ theme }) => ({
  flexShrink: 0,
  padding: "4px 9px",
  borderRadius: 999,
  color: theme.palette.text.primary,
  backgroundColor: nuiTokens.surfaceRaised,
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
  fontSize: 12,
  fontWeight: 750,
  fontVariantNumeric: "tabular-nums",
}));

const SyncPill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "online",
})<{ online: boolean }>(({ theme, online }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  marginTop: 5,
  color: online ? theme.palette.success.light : theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 650,
  "& svg": { fontSize: 14 },
}));

const Metrics = styled(Box)({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 7,
});

const MetricPill = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 32,
  padding: "0 10px",
  borderRadius: 999,
  color: theme.palette.text.secondary,
  backgroundColor: nuiTokens.surface,
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
  fontSize: 12,
  fontWeight: 650,
  "& svg": {
    color: theme.palette.primary.main,
    fontSize: 16,
  },
  "& strong": {
    color: theme.palette.text.primary,
    fontVariantNumeric: "tabular-nums",
  },
}));

const ControlsGrid = styled(Box)({
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1.35fr) minmax(170px, 0.8fr) minmax(210px, 1fr)",
  gap: 10,
  marginTop: 16,
  "@media (max-width: 920px)": {
    gridTemplateColumns: "1fr",
  },
});

const Control = styled(Box)({
  minWidth: 0,
});

const ControlLabel = styled("label")(({ theme }) => ({
  ...microLabel,
  display: "block",
  marginBottom: 6,
  color: theme.palette.text.secondary,
}));

const DirectoryField = styled(TextField)(({ theme }) => ({
  width: "100%",
  "& .MuiOutlinedInput-root": {
    minHeight: 42,
    borderRadius: nuiTokens.radiusXs,
    color: theme.palette.text.primary,
    backgroundColor: "rgba(0,0,0,0.18)",
    transition: "background-color 120ms ease, box-shadow 120ms ease",
    "& fieldset": {
      borderColor: nuiTokens.ringStrong,
    },
    "&:hover": {
      backgroundColor: "rgba(0,0,0,0.24)",
    },
    "&:hover fieldset": {
      borderColor: alpha(theme.palette.primary.main, 0.55),
    },
    "&.Mui-focused": {
      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`,
    },
    "&.Mui-focused fieldset": {
      borderColor: theme.palette.primary.main,
    },
  },
  "& .MuiInputBase-input, & .MuiSelect-select": {
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 13.5,
    fontWeight: 550,
  },
  "& .MuiInputBase-input::placeholder": {
    color: theme.palette.text.secondary,
    opacity: 0.9,
  },
}));

interface PlayerPageHeaderProps {
  visiblePlayerCount: number;
}

export const PlayerPageHeader: React.FC<PlayerPageHeaderProps> = ({
  visiblePlayerCount,
}) => {
  const [filterType, setFilterType] = usePlayersFilterBy();
  const [sortType, setSortType] = usePlayersSortBy();
  const [playerSearch, setPlayerSearch] = usePlayersSearch();
  const allPlayers = usePlayersState();
  const [searchVal, setSearchVal] = useState("");
  const setPlayersFilterIsTemp = useSetPlayersFilterIsTemp();
  const serverCtx = useServerCtxValue();
  const t = useTranslate();

  const debouncedInput = useDebounce<string>(searchVal, 350);

  const onFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterType(event.target.value as PlayerDataFilter);
  };

  const onSortChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSortType(event.target.value as PlayerDataSort);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchVal(event.target.value);
    setPlayersFilterIsTemp(false);
  };

  useEffect(() => {
    setPlayerSearch(debouncedInput);
  }, [debouncedInput, setPlayerSearch]);

  useEffect(() => {
    setSearchVal(playerSearch);
  }, [playerSearch]);

  const counts = useMemo(
    () => ({
      admins: allPlayers.filter((player) => player.admin).length,
      injured: allPlayers.filter(
        (player) => player.health >= 0 && player.health <= 20
      ).length,
      inVehicle: allPlayers.filter(
        (player) => player.vType !== VehicleStatus.Walking
      ).length,
    }),
    [allPlayers]
  );

  const oneSyncStatus = serverCtx.oneSync.status
    ? `OneSync${serverCtx.oneSync.type ? ` · ${serverCtx.oneSync.type}` : ""}`
    : "OneSync Off";
  const SyncIcon = serverCtx.oneSync.status ? WifiRounded : WifiOffRounded;
  const hasActiveQuery =
    filterType !== PlayerDataFilter.NoFilter || searchVal.trim().length > 0;

  return (
    <HeaderRoot>
      <HeaderSummary>
        <Box display="flex" alignItems="center" gap={1.25} minWidth={0}>
          <DirectoryIcon aria-hidden="true">
            <GroupsRounded />
          </DirectoryIcon>
          <Box minWidth={0}>
            <Typography sx={{ ...microLabel }} color="text.secondary">
              {t("nui_menu.page_players.misc.online_players")}
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mt={0.25}>
              <Typography
                component="h1"
                noWrap
                sx={{ fontSize: 24, fontWeight: 780, lineHeight: 1.1 }}
              >
                {t("nui_menu.page_players.misc.players")}
              </Typography>
              <CountPill>
                {hasActiveQuery ? `${visiblePlayerCount} · ` : ""}
                {allPlayers.length}/{serverCtx.maxClients}
              </CountPill>
            </Box>
            <SyncPill online={serverCtx.oneSync.status}>
              <SyncIcon />
              {oneSyncStatus}
            </SyncPill>
          </Box>
        </Box>

        <Metrics>
          <MetricPill title={t("nui_menu.page_players.filter.is_admin")}>
            <SecurityRounded />
            <strong>{counts.admins}</strong>
            {t("nui_menu.page_players.filter.is_admin")}
          </MetricPill>
          <MetricPill title={t("nui_menu.page_players.filter.is_injured")}>
            <FavoriteRounded />
            <strong>{counts.injured}</strong>
            {t("nui_menu.page_players.filter.is_injured")}
          </MetricPill>
          <MetricPill title={t("nui_menu.page_players.filter.in_vehicle")}>
            <DirectionsCarRounded />
            <strong>{counts.inVehicle}</strong>
            {t("nui_menu.page_players.filter.in_vehicle")}
          </MetricPill>
        </Metrics>
      </HeaderSummary>

      <ControlsGrid>
        <Control>
          <ControlLabel htmlFor="player-directory-search">
            {t("nui_menu.page_players.misc.search")}
          </ControlLabel>
          <DirectoryField
            id="player-directory-search"
            variant="outlined"
            size="small"
            placeholder={t("nui_menu.page_players.misc.search")}
            value={searchVal}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: "text.secondary" }}>
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Control>

        <Control>
          <ControlLabel htmlFor="player-directory-filter">
            {t("nui_menu.page_players.filter.label")}
          </ControlLabel>
          <DirectoryField
            id="player-directory-filter"
            variant="outlined"
            size="small"
            select
            onChange={onFilterChange}
            value={filterType}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: "text.secondary" }}>
                  <FilterAltRounded fontSize="small" />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value={PlayerDataFilter.NoFilter}>
              {t("nui_menu.page_players.filter.no_filter")}
            </MenuItem>
            <MenuItem value={PlayerDataFilter.IsAdmin}>
              {t("nui_menu.page_players.filter.is_admin")}
            </MenuItem>
            <MenuItem value={PlayerDataFilter.IsInjured}>
              {t("nui_menu.page_players.filter.is_injured")}
            </MenuItem>
            <MenuItem value={PlayerDataFilter.InVehicle}>
              {t("nui_menu.page_players.filter.in_vehicle")}
            </MenuItem>
          </DirectoryField>
        </Control>

        <Control>
          <ControlLabel htmlFor="player-directory-sort">
            {t("nui_menu.page_players.sort.label")}
          </ControlLabel>
          <DirectoryField
            id="player-directory-sort"
            variant="outlined"
            size="small"
            select
            onChange={onSortChange}
            value={sortType}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: "text.secondary" }}>
                  <SwapVertRounded fontSize="small" />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value={PlayerDataSort.IdJoinedFirst}>
              {`${t("nui_menu.page_players.sort.id")} · ${t(
                "nui_menu.page_players.sort.joined_first"
              )}`}
            </MenuItem>
            <MenuItem value={PlayerDataSort.IdJoinedLast}>
              {`${t("nui_menu.page_players.sort.id")} · ${t(
                "nui_menu.page_players.sort.joined_last"
              )}`}
            </MenuItem>
            <MenuItem value={PlayerDataSort.DistanceClosest}>
              {`${t("nui_menu.page_players.sort.distance")} · ${t(
                "nui_menu.page_players.sort.closest"
              )}`}
            </MenuItem>
            <MenuItem value={PlayerDataSort.DistanceFarthest}>
              {`${t("nui_menu.page_players.sort.distance")} · ${t(
                "nui_menu.page_players.sort.farthest"
              )}`}
            </MenuItem>
          </DirectoryField>
        </Control>
      </ControlsGrid>
    </HeaderRoot>
  );
};
