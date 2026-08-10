import React from "react";
import { Box, Collapse, Typography, alpha, styled, useTheme } from "@mui/material";
import { PageTabs } from "@nui/src/components/misc/PageTabs";
import { txAdminMenuPage, usePageValue } from "@nui/src/state/page.state";
import { MainPageList } from "@nui/src/components/MainPage/MainPageList";
import { useServerCtxValue } from "@nui/src/state/server.state";
import { useDebounce } from "@nui/src/hooks/useDebouce";
import { microLabel, nuiTokens } from "@nui/src/styles/nuiTokens";
import { useIsMenuVisibleValue } from "@nui/src/state/visibility.state";

const StyledRoot = styled(Box)(({ theme }) => ({
  height: "fit-content",
  width: nuiTokens.panelWidth,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  borderRadius: nuiTokens.radius,
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.default,
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}, 0 24px 70px rgba(0,0,0,0.48)`,
  overflow: "hidden",
  userSelect: "none",
}));

/**
 * The identity block. Server branding gets a compact logo slot rather than the
 * full-width banner the old header stretched across the panel.
 */
const HeaderRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "3px 2px 13px",
  borderBottom: nuiTokens.dashedBorder,
});

const LogoSlot = styled(Box)(({ theme }) => ({
  flexShrink: 0,
  width: 38,
  height: 38,
  borderRadius: nuiTokens.radiusXs,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  backgroundColor: alpha(theme.palette.primary.main, 0.14),
  boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.24)}`,
}));

const VersionPill = styled(Box)(({ theme }) => ({
  ...microLabel,
  marginLeft: "auto",
  padding: "3px 8px",
  borderRadius: 999,
  color: theme.palette.text.secondary,
  backgroundColor: nuiTokens.surface,
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
}));

export const MenuRootContent: React.FC = React.memo(() => {
  const theme = useTheme();
  const serverCtx = useServerCtxValue();
  const curPage = usePageValue();
  const isMenuVisible = useIsMenuVisibleValue();

  // Hack to prevent collapse transition from breaking
  // In some cases, i.e, when setting target player from playerModal
  // Collapse transition can break due to multiple page updates within a short
  // time frame
  const debouncedCurPage = useDebounce(curPage, 50);

  const fallbackLogo = theme.name === 'fivem' ? 'images/txadmin.png' : 'images/txadmin-redm.png';

  return (
    <StyledRoot>
      <HeaderRow>
        <LogoSlot>
          <img
            src={isMenuVisible ? serverCtx.logoUrl || fallbackLogo : fallbackLogo}
            alt={serverCtx.panelName}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </LogoSlot>
        <Box minWidth={0}>
          <Typography
            noWrap
            title={serverCtx.panelName}
            sx={{ fontSize: 15, fontWeight: 750, lineHeight: 1.25 }}
          >
            {serverCtx.panelName}
          </Typography>
          {serverCtx.projectName && <Typography
            noWrap
            sx={{ ...microLabel }}
            color="text.secondary"
            title={serverCtx.projectName}
          >
            {serverCtx.projectName}
          </Typography>}
        </Box>
        <VersionPill>v{serverCtx.txAdminVersion}</VersionPill>
      </HeaderRow>

      <PageTabs />

      <Collapse
        in={debouncedCurPage === txAdminMenuPage.Main}
        unmountOnExit
        mountOnEnter
      >
        <MainPageList />
      </Collapse>
    </StyledRoot>
  );
});
