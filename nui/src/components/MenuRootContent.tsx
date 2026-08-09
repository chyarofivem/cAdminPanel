import React from "react";
import { Box, Collapse, styled, Typography, useTheme } from "@mui/material";
import { PageTabs} from "@nui/src/components/misc/PageTabs";
import { txAdminMenuPage, usePageValue } from "@nui/src/state/page.state";
import { MainPageList } from "@nui/src/components/MainPage/MainPageList";
import { useServerCtxValue } from "@nui/src/state/server.state";
import { useDebounce } from "@nui/src/hooks/useDebouce";

interface TxAdminLogoProps {
  themeName: string;
  bannerUrl: string;
  panelName: string;
}

const TxAdminLogo: React.FC<TxAdminLogoProps> = ({ themeName, bannerUrl, panelName }) => {
  const imgName = themeName === 'fivem' ? 'txadmin.png' : 'txadmin-redm.png';
  return (
    <Box display="flex" justifyContent="center" sx={{ minHeight: 58, alignItems: 'center' }}>
      <img
        src={bannerUrl || `images/${imgName}`}
        alt={panelName}
        title={panelName}
        style={{ maxWidth: 290, maxHeight: 58, objectFit: 'contain' }}
      />
    </Box>
  )
};

const StyledRoot = styled(Box)(({ theme }) => ({
  height: "fit-content",
  background: `linear-gradient(145deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 72%)`,
  width: 348,
  borderRadius: 18,
  border: "1px solid rgba(255, 255, 255, 0.09)",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.48), inset 0 1px rgba(255,255,255,.04)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  userSelect: "none",
}));

export const MenuRootContent: React.FC = React.memo(() => {
  const theme = useTheme();
  const serverCtx = useServerCtxValue();
  const curPage = usePageValue()
  const padSize = Math.max(0, 9 - serverCtx.txAdminVersion.length);
  const versionPad = "\u0020\u205F".repeat(padSize);

  // Hack to prevent collapse transition from breaking
  // In some cases, i.e, when setting target player from playerModal
  // Collapse transition can break due to multiple page updates within a short
  // time frame
  const debouncedCurPage = useDebounce(curPage, 50)

  return (
    <StyledRoot p={2} pb={1.5}>
      <TxAdminLogo themeName={theme.name} bannerUrl={serverCtx.bannerUrl} panelName={serverCtx.panelName}/>
      <Typography
        color="textSecondary"
        style={{
          fontWeight: 500,
          marginTop: -18,
          marginBottom: 8,
          textAlign: "right",
          fontSize: 12,
        }}
      >
        v{serverCtx.txAdminVersion}
        {versionPad}
      </Typography>
      <PageTabs />
      <Collapse
        in={debouncedCurPage === txAdminMenuPage.Main}
        unmountOnExit
        mountOnEnter
      >
        <MainPageList />
      </Collapse>
    </StyledRoot>)
});
