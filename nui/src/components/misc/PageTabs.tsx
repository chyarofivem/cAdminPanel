import React, { useCallback } from "react";
import { useTranslate } from "react-polyglot";
import { usePage } from "../../state/page.state";
import { useKey } from "../../hooks/useKey";
import { useTabDisabledValue } from "../../state/keys.state";
import { useIsMenuVisibleValue } from "../../state/visibility.state";
import { useServerCtxValue } from "../../state/server.state";

/**
 * The page strip: raise-to-transparent gradient, active tab on raise-2.
 * The switch-page key cycles through the same three pages.
 */
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
    <div className="tabs" role="tablist" aria-label={t("nui_menu.help.pages")}>
      {tabs.map((label, index) => (
        <button
          key={label}
          type="button"
          role="tab"
          aria-selected={page === index}
          className={page === index ? "tab is-active" : "tab"}
          onClick={() => setPage(index)}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
