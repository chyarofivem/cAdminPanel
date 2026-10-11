import React from "react";
import { useTranslate } from "react-polyglot";
import { PageTabs } from "./misc/PageTabs";
import { txAdminMenuPage, usePageValue } from "../state/page.state";
import { MainPageList } from "./MainPage/MainPageList";
import { useServerCtxValue } from "../state/server.state";
import { useDebounce } from "../hooks/useDebouce";
import { useIsMenuVisibleValue } from "../state/visibility.state";
import { useMenuHelp } from "../provider/MenuHelpProvider";

/**
 * The compact panel: identity, page tabs, and on the main page the action list
 * with a help line describing the selected action.
 */
export const MenuRootContent: React.FC = React.memo(() => {
  const t = useTranslate();
  const serverCtx = useServerCtxValue();
  const curPage = usePageValue();
  const isMenuVisible = useIsMenuVisibleValue();
  const { helpText } = useMenuHelp();

  // Multiple page updates in a short time frame (eg. opening a player from the
  // modal) would otherwise flash the main list.
  const debouncedCurPage = useDebounce(curPage, 50);
  const isMainPage = debouncedCurPage === txAdminMenuPage.Main;

  //Only request the server logo while the menu is on screen, otherwise fall back
  //to a monogram derived from the panel name.
  const logoUrl = isMenuVisible ? serverCtx.logoUrl : undefined;
  const monogram = (serverCtx.panelName ?? "").trim().charAt(0).toUpperCase() || "P";
  const subtitle = serverCtx.projectName && serverCtx.projectName !== serverCtx.panelName
    ? serverCtx.projectName
    : null;

  return (
    <aside className="menu-panel" aria-label={serverCtx.panelName}>
      <header className="menu-header">
        <div className="menu-logo" aria-hidden={!logoUrl}>
          {logoUrl ? <img src={logoUrl} alt={serverCtx.panelName} /> : monogram}
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="menu-title truncate" title={serverCtx.panelName}>{serverCtx.panelName}</p>
          {subtitle && <p className="menu-subtitle truncate" title={subtitle}>{subtitle}</p>}
        </div>
      </header>

      <PageTabs />

      {isMainPage && (
        <div className="menu-body">
          <MainPageList />
          <div className="menu-help">
            <p className="menu-help-text" aria-live="polite">{helpText}</p>
            <div className="menu-keys" aria-hidden="true">
              <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd>{t("nui_menu.help.navigate")}</span>
              <span><kbd className="kbd">←</kbd><kbd className="kbd">→</kbd>{t("nui_menu.help.change")}</span>
              <span><kbd className="kbd">Enter</kbd>{t("nui_menu.help.run")}</span>
              <span><kbd className="kbd">{serverCtx.switchPageKey}</kbd>{t("nui_menu.help.switch_page")}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
});
