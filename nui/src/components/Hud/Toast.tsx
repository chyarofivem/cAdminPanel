import React, { useRef } from "react";
import {
  SnackbarContent,
  Transition,
  type CustomContentProps,
  type TransitionProps,
} from "notistack";
import {
  AlertTriangleIcon,
  CircleCheckIcon,
  CircleXIcon,
  InfoCircleIcon,
} from "../ui/icons";

type CommunicationKind = "announcement" | "direct-message" | "restart";

type ToastLook = { className: string; Icon: React.FC };

/**
 * Toasts sit on the modal surface with the modal shadow. A 16px status icon in the
 * status text colour leads, then the title and an optional muted line. The
 * communication kinds (announcement, DM, restart) are the same card: announcements
 * take the warning triangle, restarts the error circle, and direct messages and
 * default toasts an info circle in the accent text colour.
 */
const variantLook: Record<string, ToastLook> = {
  default: { className: "toast", Icon: InfoCircleIcon },
  info: { className: "toast toast-info", Icon: InfoCircleIcon },
  success: { className: "toast toast-success", Icon: CircleCheckIcon },
  warning: { className: "toast toast-warning", Icon: AlertTriangleIcon },
  error: { className: "toast toast-error", Icon: CircleXIcon },
};

const communicationLook: Record<CommunicationKind, ToastLook> = {
  announcement: { className: "toast toast-warning", Icon: AlertTriangleIcon },
  "direct-message": { className: "toast", Icon: InfoCircleIcon },
  restart: { className: "toast toast-error", Icon: CircleXIcon },
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
    const { className: toastClass, Icon } = communicationKind
      ? communicationLook[communicationKind]
      : variantLook[variant] ?? variantLook.default;
    const isAlert = !communicationKind && (variant === "error" || variant === "warning");
    return (
      <SnackbarContent
        ref={ref}
        role={isAlert ? "alert" : "status"}
        aria-live={isAlert ? "assertive" : "polite"}
        className={toastClass}
        style={style}
      >
        {/* One child row, so notistack's own flex-wrap on SnackbarContent never
            pushes the text under the icon. */}
        <div className="toast-row">
          <span className="toast-icon" aria-hidden="true"><Icon /></span>
          <div className="toast-content">{message}</div>
        </div>
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
