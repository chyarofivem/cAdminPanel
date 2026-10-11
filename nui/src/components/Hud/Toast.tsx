import React, { useRef } from "react";
import {
  SnackbarContent,
  Transition,
  type CustomContentProps,
  type TransitionProps,
} from "notistack";

type CommunicationKind = "announcement" | "direct-message" | "restart";

/**
 * Toasts use the menu surface with a 4px status bar on the start edge.
 * The communication kinds (announcement, DM, restart) are the same card with a
 * title; announcements and restarts carry status colours, DMs follow the accent.
 */
const variantClass: Record<string, string> = {
  default: "toast",
  info: "toast toast-info",
  success: "toast toast-success",
  warning: "toast toast-warning",
  error: "toast toast-error",
};

const communicationClass: Record<CommunicationKind, string> = {
  announcement: "toast toast-warning",
  "direct-message": "toast",
  restart: "toast toast-error",
};

const getCommunicationKind = (className?: string): CommunicationKind | null => {
  if (!className) return null;
  if (className.includes("tx-communication-notification--announcement")) return "announcement";
  if (className.includes("tx-communication-notification--direct-message")) return "direct-message";
  if (className.includes("tx-communication-notification--restart")) return "restart";
  return null;
};

export const Toast = React.forwardRef<HTMLDivElement, CustomContentProps>(
  ({ message, variant, className, style }, ref) => {
    const communicationKind = getCommunicationKind(className);
    const toastClass = communicationKind
      ? communicationClass[communicationKind]
      : variantClass[variant] ?? variantClass.default;
    const isAlert = !communicationKind && (variant === "error" || variant === "warning");
    return (
      <SnackbarContent
        ref={ref}
        role={isAlert ? "alert" : "status"}
        aria-live={isAlert ? "assertive" : "polite"}
        className={toastClass}
        style={style}
      >
        {message}
      </SnackbarContent>
    );
  }
);
Toast.displayName = "Toast";

const setRef = <T,>(ref: React.Ref<T> | undefined, value: T | null) => {
  if (typeof ref === "function") ref(value);
  else if (ref && typeof ref === "object") (ref as React.MutableRefObject<T | null>).current = value;
};

/**
 * Toasts appear without an entrance animation and fade out in 150ms.
 */
export const ToastTransition = React.forwardRef<unknown, TransitionProps & { children: React.ReactElement }>(
  ({ children, in: inProp, timeout = { enter: 0, exit: 150 }, ...other }, forwardedRef) => {
    const nodeRef = useRef<HTMLDivElement>(null);
    const childRef = (children as unknown as { ref?: React.Ref<HTMLDivElement> }).ref;
    const handleRef = (node: HTMLDivElement | null) => {
      (nodeRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      setRef(childRef, node);
      setRef(forwardedRef as React.Ref<HTMLDivElement>, node);
    };

    return (
      <Transition appear in={inProp} nodeRef={nodeRef} timeout={timeout} {...other}>
        {(status, childProps) => React.cloneElement(children, {
          ref: handleRef,
          style: {
            opacity: status === "exiting" || status === "exited" ? 0 : 1,
            visibility: status === "exited" && !inProp ? "hidden" : undefined,
            transition: "opacity 150ms ease",
            ...children.props.style,
          },
          ...childProps,
        })}
      </Transition>
    );
  }
);
ToastTransition.displayName = "ToastTransition";
