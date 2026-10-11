import React, { useEffect, useId, useRef, useState } from "react";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type SelectProps<T extends string> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  id?: string;
  "aria-label"?: string;
  small?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * A small listbox. Native <select> popups are unreliable in the game's off-screen
 * browser, so the menu draws its own: menu surface, radius-xs, hairline dividers,
 * and the selected option in the accent text colour.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  id,
  small,
  disabled,
  className,
  ...props
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    setHighlighted(selectedIndex);
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open, selectedIndex]);

  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      //A closed select lets Escape through, so the surrounding modal or menu closes.
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
      }
      return;
    }
    //While open, keep the menu's global key handlers (Escape closes the menu) out of it.
    if (["Escape", "ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) {
      event.stopPropagation();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => Math.min(options.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(highlighted);
    }
  };

  return (
    <div ref={rootRef} className={["select", small ? "select-sm" : "", className ?? ""].filter(Boolean).join(" ")}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={props["aria-label"]}
        disabled={disabled}
        className={open ? "select-trigger is-open" : "select-trigger"}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <span className="truncate">{options[selectedIndex]?.label}</span>
        <span className="select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} role="listbox" className="select-menu">
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={[
                "select-option",
                index === highlighted ? "is-highlighted" : "",
                option.value === value ? "is-selected" : "",
              ].filter(Boolean).join(" ")}
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(index);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
