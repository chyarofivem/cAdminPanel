import React, { useCallback } from "react";
import { Box, ButtonBase, alpha, styled } from "@mui/material";
import { usePage } from "../../state/page.state";
import { useKey } from "../../hooks/useKey";
import { useTabDisabledValue } from "../../state/keys.state";
import { useIsMenuVisibleValue } from "../../state/visibility.state";
import { useServerCtxValue } from "../../state/server.state";
import { useTranslate } from "react-polyglot";
import { microLabel, nuiTokens } from "@nui/src/styles/nuiTokens";

const TabRail = styled(Box)({
  display: "flex",
  gap: 4,
  padding: 4,
  borderRadius: nuiTokens.radiusSm,
  backgroundColor: nuiTokens.surface,
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
});

const TabButton = styled(ButtonBase, {
  shouldForwardProp: (prop) => prop !== "isActive",
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  ...microLabel,
  flex: 1,
  minHeight: 38,
  padding: "0 8px",
  borderRadius: nuiTokens.radiusXs,
  color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
  backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.16) : "transparent",
  boxShadow: isActive ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.34)}` : "none",
  transition: "background-color 120ms ease, color 120ms ease, box-shadow 120ms ease",
  "&:hover": {
    backgroundColor: isActive
      ? alpha(theme.palette.primary.main, 0.2)
      : nuiTokens.surfaceHover,
  },
}));

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

  const tabs = [
    t("nui_menu.tabs.main"),
    t("nui_menu.tabs.players"),
    t("nui_menu.tabs.panel"),
  ];

  return (
    <TabRail>
      {tabs.map((label, index) => (
        <TabButton
          key={label}
          isActive={page === index}
          onClick={() => setPage(index)}
          disableRipple
        >
          {label}
        </TabButton>
      ))}
    </TabRail>
  );
};
