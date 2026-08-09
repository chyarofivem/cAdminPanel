import React, { memo, useEffect, useRef, useState } from "react";
import { Box, ButtonBase, Typography, alpha, styled } from "@mui/material";
import { useKeyboardNavigation } from "../../hooks/useKeyboardNavigation";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { fetchNui } from "../../utils/fetchNui";
import { useTranslate } from "react-polyglot";
import {
  ResolvablePermission,
  usePermissionsValue,
} from "../../state/permissions.state";
import { userHasPerm } from "../../utils/miscUtils";
import { useSnackbar } from "notistack";
import { useTooltip } from "../../provider/TooltipProvider";
import { microLabel, nuiTokens } from "@nui/src/styles/nuiTokens";

/**
 * A single actionable row. Selection is driven by keyboard navigation from
 * MainPageList, so the visual affordance has to read clearly without hover.
 */
const RowButton = styled(ButtonBase, {
  shouldForwardProp: (prop) => prop !== "isActive" && prop !== "isDimmed",
})<{ isActive: boolean; isDimmed: boolean }>(({ theme, isActive, isDimmed }) => ({
  width: "100%",
  minHeight: 48,
  padding: "8px 11px",
  marginBottom: 4,
  borderRadius: nuiTokens.radiusSm,
  display: "flex",
  alignItems: "center",
  gap: 10,
  textAlign: "left",
  justifyContent: "flex-start",
  color: theme.palette.text.primary,
  opacity: isDimmed ? 0.58 : 1,
  backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.12) : "transparent",
  borderLeft: `3px solid ${isActive ? theme.palette.primary.main : 'transparent'}`,
  boxShadow: isActive
    ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.34)}`
    : `inset 0 0 0 1px transparent`,
  transition: "background-color 120ms ease, box-shadow 120ms ease",
  "&:hover": {
    backgroundColor: isActive
      ? alpha(theme.palette.primary.main, 0.16)
      : nuiTokens.surfaceHover,
  },
}));

/**
 * The leading icon chip. Uses the accent tint when the row is selected so the
 * eye lands on the same element the keyboard is pointing at.
 */
const IconChip = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isActive",
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  flexShrink: 0,
  width: 32,
  height: 32,
  borderRadius: nuiTokens.radiusXs,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
  backgroundColor: isActive
    ? alpha(theme.palette.primary.main, 0.14)
    : nuiTokens.surface,
  boxShadow: `inset 0 0 0 1px ${nuiTokens.ring}`,
  transition: "color 120ms ease, background-color 120ms ease",
  "& svg": { fontSize: 18 },
}));

const RowTitle = styled(Typography)({
  fontSize: 14.5,
  fontWeight: 500,
  lineHeight: 1.3,
});

const RowValue = styled(Typography)({
  ...microLabel,
  marginTop: 1,
  letterSpacing: '0.06em',
});

/**
 * The left/right cycling affordance shown on multi-action rows. Only rendered
 * as interactive-looking when the row is selected, since the arrow keys only
 * act on the selected row.
 */
const CycleHint = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isActive",
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
  opacity: isActive ? 1 : 0.65,
  "& svg": { fontSize: 15 },
}));

export interface MenuListItemProps {
  title: string;
  label: string;
  requiredPermission?: ResolvablePermission;
  icon: JSX.Element;
  selected: boolean;
  onSelect: () => void;
}


export const MenuListItem: React.FC<MenuListItemProps> = memo(
  ({ title, label, requiredPermission, icon, selected, onSelect }) => {

    const t = useTranslate();
    const divRef = useRef<HTMLDivElement | null>(null);
    const userPerms = usePermissionsValue();
    const isUserAllowed = requiredPermission
      ? userHasPerm(requiredPermission, userPerms)
      : true;
    const { enqueueSnackbar } = useSnackbar();
    const { setTooltipText } = useTooltip();

    const handleEnter = (): void => {
      if (!selected) return;

      if (!isUserAllowed) {
        enqueueSnackbar(t("nui_menu.misc.no_perms"), {
          variant: "error",
          anchorOrigin: {
            horizontal: "center",
            vertical: "bottom",
          },
        });
        return;
      }

      fetchNui("playSound", "enter");
      onSelect();
    };

    useEffect(() => {
      if (selected && divRef) {
        divRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }
    }, [selected]);

    useEffect(() => {
      if (selected) {
        setTooltipText(label);
      }
    }, [selected]);

    useKeyboardNavigation({
      onEnterDown: handleEnter,
      disableOnFocused: true,
    });

    return (
      <div ref={divRef}>
        <RowButton
          onClick={handleEnter}
          isActive={selected}
          isDimmed={!isUserAllowed}
          disableRipple
        >
          <IconChip isActive={selected}>{icon}</IconChip>
          <RowTitle>{title}</RowTitle>
        </RowButton>
      </div>
    );
  }
);

interface MenuListItemMultiAction {
  name?: string | JSX.Element;
  label: string;
  value: string | number | boolean;
  icon?: JSX.Element;
  onSelect: () => void;
}

export interface MenuListItemMultiProps {
  title: string;
  requiredPermission?: ResolvablePermission;
  initialValue?: MenuListItemMultiAction;
  selected: boolean;
  icon: JSX.Element;
  actions: MenuListItemMultiAction[];
}

export const MenuListItemMulti: React.FC<MenuListItemMultiProps> = memo(
  ({ selected, title, actions, icon, initialValue, requiredPermission }) => {

    const t = useTranslate();
    const [curState, setCurState] = useState(0);
    const userPerms = usePermissionsValue();
    const { enqueueSnackbar } = useSnackbar();
    const { setTooltipText } = useTooltip();

    const isUserAllowed = requiredPermission
      ? userHasPerm(requiredPermission, userPerms)
      : true;

    const compMounted = useRef(false);

    const divRef = useRef<HTMLDivElement | null>(null);

    const showNotAllowedAlert = () => {
      enqueueSnackbar(t("nui_menu.misc.no_perms"), {
        variant: "error",
        anchorOrigin: {
          horizontal: "center",
          vertical: "bottom",
        },
      });
    };

    useEffect(() => {
      if (selected && divRef) {
        divRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }
    }, [selected]);

    // Mount/unmount detection
    // We will only run this hook after initial mount
    // and not on unmount.
    // NOTE: This hook does not work if actions prop are dynamic
    useEffect(() => {
      if (!compMounted.current) {
        compMounted.current = true;
        // We will set the initial value of the item based on the passed initial value
        const index = actions.findIndex((a) => a.value === initialValue?.value);
        setCurState(index > -1 ? index : 0);
      }
    }, [curState]);

    useEffect(() => {
      if (actions[curState]?.label && selected) {
        setTooltipText(actions[curState]?.label);
      }
    }, [curState, selected]);

    const handleLeftArrow = () => {
      if (!selected) return;

      fetchNui("playSound", "move").catch();
      const nextEstimatedItem = curState - 1;
      const nextItem =
        nextEstimatedItem < 0 ? actions.length - 1 : nextEstimatedItem;
      setCurState(nextItem);
    };

    const handleRightArrow = () => {
      if (!selected) return;

      fetchNui("playSound", "move");
      const nextEstimatedItem = curState + 1;
      const nextItem =
        nextEstimatedItem >= actions.length ? 0 : nextEstimatedItem;
      setCurState(nextItem);
    };

    const handleEnter = () => {
      if (!selected) return;
      if (!isUserAllowed) return showNotAllowedAlert();

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
      <div ref={divRef}>
        <RowButton
          onClick={handleEnter}
          isActive={selected}
          isDimmed={!isUserAllowed}
          disableRipple
        >
          <IconChip isActive={selected}>
            {actions[curState]?.icon ?? icon}
          </IconChip>
          <Box flex={1} minWidth={0}>
            <RowTitle>{title}</RowTitle>
            <RowValue color="text.secondary">
              {actions[curState]?.name ?? "???"}
            </RowValue>
          </Box>
          <CycleHint isActive={selected}>
            <ChevronLeft />
            <ChevronRight />
          </CycleHint>
        </RowButton>
      </div>
    );
  }
);
