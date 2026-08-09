import React, { memo } from "react";
import {
  alpha,
  Box,
  ButtonBase,
  styled,
  Theme,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ChevronRightRounded,
  DirectionsBoatRounded,
  DirectionsWalkRounded,
  DriveEtaRounded,
  FavoriteRounded,
  FlightRounded,
  HelpOutlineRounded,
  NearMeRounded,
  SecurityRounded,
  TwoWheelerRounded,
} from "@mui/icons-material";
import { useSetAssociatedPlayer } from "../../state/playerDetails.state";
import { formatDistance } from "../../utils/miscUtils";
import { useTranslate } from "react-polyglot";
import { PlayerData, VehicleStatus } from "../../hooks/usePlayerListListener";
import { useSetPlayerModalVisibility } from "@nui/src/state/playerModal.state";
import { microLabel, nuiTokens } from "@nui/src/styles/nuiTokens";

const PlayerButton = styled(ButtonBase)(({ theme }) => ({
  position: "relative",
  display: "flex",
  width: "100%",
  minWidth: 0,
  minHeight: 112,
  padding: 14,
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "space-between",
  overflow: "hidden",
  borderRadius: nuiTokens.radiusSm,
  color: theme.palette.text.primary,
  textAlign: "left",
  background: `linear-gradient(145deg, ${nuiTokens.surfaceRaised}, ${nuiTokens.surface})`,
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
  transition:
    "transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease",
  "&::after": {
    content: '""',
    position: "absolute",
    inset: "0 auto 0 0",
    width: 3,
    opacity: 0,
    backgroundColor: theme.palette.primary.main,
    transition: "opacity 120ms ease",
  },
  "&:hover": {
    transform: "translateY(-1px)",
    background: nuiTokens.surfaceHover,
    boxShadow: `inset 0 0 0 1px ${nuiTokens.ringStrong}, 0 10px 24px rgba(0,0,0,0.18)`,
  },
  "&:hover::after": {
    opacity: 1,
  },
  "&.Mui-focusVisible": {
    boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}, 0 0 0 3px ${alpha(
      theme.palette.primary.main,
      0.16
    )}`,
  },
}));

const StatusIcon = styled(Box)(({ theme }) => ({
  display: "grid",
  flexShrink: 0,
  width: 36,
  height: 36,
  placeItems: "center",
  borderRadius: nuiTokens.radiusXs,
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
  boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.24)}`,
  "& svg": { fontSize: 20 },
}));

const AdminBadge = styled(Box)(({ theme }) => ({
  display: "grid",
  flexShrink: 0,
  width: 26,
  height: 26,
  placeItems: "center",
  borderRadius: 999,
  color: theme.palette.warning.light,
  backgroundColor: alpha(theme.palette.warning.main, 0.12),
  boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.warning.main, 0.28)}`,
  "& svg": { fontSize: 15 },
}));

const HealthTrack = styled(Box, {
  shouldForwardProp: (prop) => prop !== "healthVal",
})<{ healthVal: number }>(({ healthVal }) => ({
  width: "100%",
  height: 5,
  overflow: "hidden",
  borderRadius: 999,
  backgroundColor:
    healthVal < 0
      ? "rgba(255,255,255,0.1)"
      : healthVal <= 20
        ? "rgba(211,47,47,0.2)"
        : healthVal <= 60
          ? "rgba(237,108,2,0.2)"
          : "rgba(46,125,50,0.2)",
}));

const getHealthColor = (health: number, theme: Theme) => {
  if (health < 0) return theme.palette.text.secondary;
  if (health <= 20) return theme.palette.error.light;
  if (health <= 60) return theme.palette.warning.light;
  return theme.palette.success.light;
};

const HealthValue = styled(Box, {
  shouldForwardProp: (prop) => prop !== "healthVal",
})<{ healthVal: number }>(({ healthVal, theme }) => ({
  height: "100%",
  borderRadius: 999,
  backgroundColor: getHealthColor(healthVal, theme),
  transition: "width 200ms ease",
}));

const StatText = styled(Typography)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 650,
  fontVariantNumeric: "tabular-nums",
  "& svg": { fontSize: 14 },
}));

const statusMeta = {
  [VehicleStatus.Unknown]: {
    Icon: HelpOutlineRounded,
    label: "Unknown",
  },
  [VehicleStatus.Walking]: {
    Icon: DirectionsWalkRounded,
    label: "Walking",
  },
  [VehicleStatus.Driving]: {
    Icon: DriveEtaRounded,
    label: "Driving",
  },
  [VehicleStatus.Boat]: {
    Icon: DirectionsBoatRounded,
    label: "Boating",
  },
  [VehicleStatus.Biking]: {
    Icon: TwoWheelerRounded,
    label: "Biking",
  },
  [VehicleStatus.Flying]: {
    Icon: FlightRounded,
    label: "Flying",
  },
} as const;

const PlayerCard: React.FC<{ playerData: PlayerData }> = ({ playerData }) => {
  const setModalOpen = useSetPlayerModalVisibility();
  const setAssociatedPlayer = useSetAssociatedPlayer();
  const t = useTranslate();
  const { Icon: ActivityIcon, label: activityLabel } =
    statusMeta[playerData.vType] ?? statusMeta[VehicleStatus.Unknown];

  const handlePlayerClick = () => {
    setAssociatedPlayer(playerData);
    setModalOpen(true);
  };

  const hasHealth = playerData.health >= 0;
  const normalizedHealth = hasHealth
    ? Math.min(100, Math.max(0, playerData.health))
    : 0;
  const healthLabel = t("nui_menu.page_players.card.health", {
    percentHealth: hasHealth ? normalizedHealth : "?",
  });

  return (
    <PlayerButton
      onClick={handlePlayerClick}
      aria-label={`#${playerData.id} ${playerData.displayName}`}
      focusRipple
    >
      <Box display="flex" alignItems="center" gap={1.25} minWidth={0}>
        <Tooltip title={activityLabel} placement="top" arrow>
          <StatusIcon aria-hidden="true">
            <ActivityIcon />
          </StatusIcon>
        </Tooltip>

        <Box minWidth={0} flex={1}>
          <Typography sx={{ ...microLabel }} color="text.secondary" noWrap>
            #{playerData.id} · {activityLabel}
          </Typography>
          <Typography
            noWrap
            title={playerData.displayName}
            sx={{ mt: 0.25, fontSize: 15, fontWeight: 720, lineHeight: 1.25 }}
          >
            {playerData.displayName}
          </Typography>
        </Box>

        {playerData.admin && (
          <Tooltip
            title={t("nui_menu.page_players.filter.is_admin")}
            placement="top"
            arrow
          >
            <AdminBadge aria-label={t("nui_menu.page_players.filter.is_admin")}>
              <SecurityRounded />
            </AdminBadge>
          </Tooltip>
        )}
        <ChevronRightRounded
          aria-hidden="true"
          sx={{ color: "text.secondary", fontSize: 18, opacity: 0.8 }}
        />
      </Box>

      <Box display="flex" alignItems="flex-end" gap={1.5} mt={1.5}>
        <Tooltip title={healthLabel} placement="bottom" arrow>
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
              <StatText>
                <FavoriteRounded />
                {hasHealth ? `${normalizedHealth}%` : "—"}
              </StatText>
            </Box>
            <HealthTrack healthVal={playerData.health}>
              <HealthValue
                healthVal={playerData.health}
                width={`${normalizedHealth}%`}
              />
            </HealthTrack>
          </Box>
        </Tooltip>

        <StatText>
          <NearMeRounded />
          {playerData.dist < 0 ? "? m" : formatDistance(playerData.dist)}
        </StatText>
      </Box>
    </PlayerButton>
  );
};

export default memo(PlayerCard);
