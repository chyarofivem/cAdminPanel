import React, { memo, useEffect, useRef, useState } from "react";
import { useTranslate } from "react-polyglot";
import { useSnackbar } from "notistack";
import { useKeyboardNavigation } from "../../hooks/useKeyboardNavigation";
import { fetchNui } from "../../utils/fetchNui";
import {
  ResolvablePermission,
  usePermissionsValue,
} from "../../state/permissions.state";
import { userHasPerm } from "../../utils/miscUtils";
import { useMenuHelp } from "../../provider/MenuHelpProvider";

/**
 * Main-page rows are nav rows: 44px, radius-md, body text. The keyboard cursor
 * reads like the active nav row (accent-soft background, accent text). Rows the
 * admin cannot use are dimmed and explain why on Enter.
 */
const rowClass = (selected: boolean, allowed: boolean) => [
  "action-row",
  selected ? "is-selected" : "",
  allowed ? "" : "is-locked",
].filter(Boolean).join(" ");

const useScrollIntoView = (selected: boolean) => {
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!selected) return;
    ref.current?.scrollIntoView({ block: "nearest", inline: "start" });
  }, [selected]);
  return ref;
};

export interface MenuListItemProps {
  title: string;
  label: string;
  requiredPermission?: ResolvablePermission;
  selected: boolean;
  onSelect: () => void;
}

export const MenuListItem: React.FC<MenuListItemProps> = memo(
  ({ title, label, requiredPermission, selected, onSelect }) => {
    const t = useTranslate();
    const userPerms = usePermissionsValue();
    const isUserAllowed = requiredPermission
      ? userHasPerm(requiredPermission, userPerms)
      : true;
    const { enqueueSnackbar } = useSnackbar();
    const { setHelpText } = useMenuHelp();
    const rowRef = useScrollIntoView(selected);

    const handleEnter = (): void => {
      if (!selected) return;
      if (!isUserAllowed) {
        enqueueSnackbar(t("nui_menu.misc.no_perms"), { variant: "error" });
        return;
      }
      fetchNui("playSound", "enter");
      onSelect();
    };

    useEffect(() => {
      if (selected) setHelpText(label);
    }, [selected, label]);

    useKeyboardNavigation({
      onEnterDown: handleEnter,
      disableOnFocused: true,
    });

    return (
      <button
        ref={rowRef}
        type="button"
        tabIndex={-1}
        className={rowClass(selected, isUserAllowed)}
        aria-current={selected ? "true" : undefined}
        onClick={handleEnter}
      >
        <span className="truncate">{title}</span>
      </button>
    );
  }
);

interface MenuListItemMultiAction {
  name?: string | JSX.Element;
  label: string;
  value: string | number | boolean;
  onSelect: () => void;
}

export interface MenuListItemMultiProps {
  title: string;
  requiredPermission?: ResolvablePermission;
  initialValue?: MenuListItemMultiAction;
  selected: boolean;
  actions: MenuListItemMultiAction[];
}

export const MenuListItemMulti: React.FC<MenuListItemMultiProps> = memo(
  ({ selected, title, actions, initialValue, requiredPermission }) => {
    const t = useTranslate();
    const [curState, setCurState] = useState(0);
    const userPerms = usePermissionsValue();
    const { enqueueSnackbar } = useSnackbar();
    const { setHelpText } = useMenuHelp();
    const rowRef = useScrollIntoView(selected);
    const compMounted = useRef(false);

    const isUserAllowed = requiredPermission
      ? userHasPerm(requiredPermission, userPerms)
      : true;

    // Only on the initial mount: start on the option matching the current mode.
    // NOTE: This does not work if the actions prop is dynamic
    useEffect(() => {
      if (!compMounted.current) {
        compMounted.current = true;
        const index = actions.findIndex((a) => a.value === initialValue?.value);
        setCurState(index > -1 ? index : 0);
      }
    }, [curState]);

    useEffect(() => {
      if (actions[curState]?.label && selected) {
        setHelpText(actions[curState].label);
      }
    }, [curState, selected]);

    const handleLeftArrow = () => {
      if (!selected) return;
      fetchNui("playSound", "move").catch();
      setCurState((current) => (current - 1 < 0 ? actions.length - 1 : current - 1));
    };

    const handleRightArrow = () => {
      if (!selected) return;
      fetchNui("playSound", "move");
      setCurState((current) => (current + 1 >= actions.length ? 0 : current + 1));
    };

    const handleEnter = () => {
      if (!selected) return;
      if (!isUserAllowed) {
        enqueueSnackbar(t("nui_menu.misc.no_perms"), { variant: "error" });
        return;
      }
      fetchNui("playSound", "enter").catch();
      actions[curState].onSelect();
    };

    useKeyboardNavigation({
      onRightDown: handleRightArrow,
      onLeftDown: handleLeftArrow,
      onEnterDown: handleEnter,
      disableOnFocused: true,
    });

    return (
      <button
        ref={rowRef}
        type="button"
        tabIndex={-1}
        className={rowClass(selected, isUserAllowed)}
        aria-current={selected ? "true" : undefined}
        onClick={handleEnter}
      >
        <span className="truncate">{title}</span>
        <span className="action-value">
          <span className="cycle-hint" aria-hidden="true">‹</span>
          {actions[curState]?.name ?? "?"}
          <span className="cycle-hint" aria-hidden="true">›</span>
        </span>
      </button>
    );
  }
);
