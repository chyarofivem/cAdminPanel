import { useEffect } from "react";
import {
  DEFAULT_ACCENT,
  accentCssVars,
  isCustomAccent,
  isValidAccent,
} from "@shared/accent";
import { useServerCtxValue } from "../state/server.state";

/**
 * Applies the administrator's accent (or the server accent) to the menu.
 * `accent` is a preset id or a custom `#rrggbb`; `accentColor` is the fill hex and
 * is only used when an older resource sends no usable `accent`.
 * Only the seven accent tokens change.
 */
export const useApplyAccent = () => {
  const { accent, accentColor } = useServerCtxValue();

  useEffect(() => {
    const value = isValidAccent(accent)
      ? accent
      : isCustomAccent(accentColor)
        ? accentColor
        : DEFAULT_ACCENT;
    const root = document.documentElement;
    for (const [name, cssValue] of Object.entries(accentCssVars(value))) {
      root.style.setProperty(`--${name}`, cssValue);
    }
  }, [accent, accentColor]);
};
