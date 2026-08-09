import React, { useCallback } from "react";
import { Box, styled, Tab, Tabs } from "@mui/material";
import { usePage } from "../../state/page.state";
import { useKey } from "../../hooks/useKey";
import { useTabDisabledValue } from "../../state/keys.state";
import { useIsMenuVisibleValue } from "../../state/visibility.state";
import { useServerCtxValue } from "../../state/server.state";
import { useTranslate } from "react-polyglot";

const StyledTab = styled(Tab)({
  letterSpacing: '0.1em',
  minWidth: 100,
  minHeight: 42,
  borderRadius: 9,
  fontWeight: 700,
});

export const PageTabs: React.FC = () => {
  const [page, setPage] = usePage();
  const tabDisabled = useTabDisabledValue();
  const visible = useIsMenuVisibleValue();
  const serverCtx = useServerCtxValue();
  const t = useTranslate();

  const handleTabPress = useCallback(() => {
    if (tabDisabled || !visible) return;
    setPage((prevState) => (prevState + 1 > 2 ? 0 : prevState + 1));
  }, [tabDisabled, visible]);

  useKey(serverCtx.switchPageKey, handleTabPress);

  return (
    <Box width="100%">
      <Tabs
        value={page}
        centered
        indicatorColor="primary"
        textColor="primary"
        onChange={(_, newVal) => setPage(newVal)}
        sx={{ minHeight: 46, mb: 0.75, '& .MuiTabs-indicator': { height: 3, borderRadius: 3 } }}
      >
        <StyledTab label={t('nui_menu.tabs.main')} wrapped disableFocusRipple />
        <StyledTab label={t('nui_menu.tabs.players')} wrapped disableFocusRipple />
        <StyledTab label={t('nui_menu.tabs.panel')} wrapped disableFocusRipple />
      </Tabs>
    </Box>
  );
};
