import React from "react";
import { PlayersPage } from "./PlayersPage/PlayersPage";
import { IFramePage } from "./IFramePage/IFramePage";
import { txAdminMenuPage, usePageValue } from "../state/page.state";
import { useHudListenersService } from "../hooks/useHudListenersService";
import { useServerCtxValue } from "../state/server.state";
import { MenuRootContent } from "./MenuRootContent";

/**
 * The menu layout mirrors the web panel: a compact sidebar-like panel, and a page
 * window beside it for the Players and Panel tabs. `alignRight` mirrors the row.
 */
const MenuRoot: React.FC<{ visible: boolean }> = ({ visible }) => {
  // Mounted here so it has access to the translation context
  useHudListenersService();
  const curPage = usePageValue();
  const serverCtx = useServerCtxValue();
  const isModalOnly = curPage === txAdminMenuPage.PlayerModalOnly;

  const layoutClass = [
    "menu-layout",
    serverCtx.alignRight ? "is-right" : "",
    visible ? "" : "is-hidden",
  ].filter(Boolean).join(" ");

  return (
    <div id="menu-root" className={layoutClass} aria-hidden={!visible}>
      {!isModalOnly && <MenuRootContent />}
      {/* Always mounted: it owns the player list listener used across the menu. */}
      <PlayersPage visible={curPage === txAdminMenuPage.Players} />
      <IFramePage visible={curPage === txAdminMenuPage.IFrame} />
    </div>
  );
};

export default MenuRoot;
