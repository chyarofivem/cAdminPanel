import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "link";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * `primary` is the one filled accent action of a view. `secondary` is everything
   * else; `danger` (filled red) is reserved for a confirmation's confirm button.
   */
  variant?: ButtonVariant;
  /** Secondary button with red text, for destructive actions on a page. */
  destructive?: boolean;
  small?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", destructive, small, className, type = "button", ...props }, ref) => {
    const classes = [
      "btn",
      `btn-${variant}`,
      destructive && variant === "secondary" ? "is-danger" : "",
      small ? "btn-sm" : "",
      className ?? "",
    ].filter(Boolean).join(" ");
    return <button ref={ref} type={type} className={classes} {...props} />;
  }
);
Button.displayName = "Button";

type IconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  /** Required: becomes both the aria-label and the tooltip. */
  label: string;
  icon: React.ReactNode;
};

/**
 * The only icon-only control: 36x36, radius-sm, transparent, with a tooltip.
 */
export const IconButton: React.FC<IconButtonProps> = ({ label, icon, className, type = "button", ...props }) => (
  <button
    type={type}
    aria-label={label}
    data-tooltip={label}
    className={["icon-btn", className ?? ""].filter(Boolean).join(" ")}
    {...props}
  >
    {icon}
  </button>
);
