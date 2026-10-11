import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** id of the element that names the dialog */
  labelledBy?: string;
  wide?: boolean;
  /** Set when the modal content manages its own initial focus (eg. an autofocus input). */
  skipInitialFocus?: boolean;
  id?: string;
  children: React.ReactNode;
};

/**
 * Modal: modal surface, radius-md, modal shadow with a hairline ring, black 60%
 * backdrop without blur. Escape and a backdrop click close it, and the key events
 * stop here so the menu's own Escape handler does not close the whole menu.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  labelledBy,
  wide,
  skipInitialFocus,
  id,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  //Focus moves into the modal on open and back to where it was on close, so
  //Escape keeps reaching the right dialog when modals stack.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!skipInitialFocus) panelRef.current?.focus();
    return () => {
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open, skipInitialFocus]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={wide ? "modal modal-wide" : "modal"}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
        style={{ outline: "none" }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
