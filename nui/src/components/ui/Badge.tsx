import React from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "info";

/**
 * Status always carries a word; the colour only reinforces it.
 */
export const Badge: React.FC<{ variant?: BadgeVariant; children: React.ReactNode; title?: string }> = ({
  variant = "default",
  children,
  title,
}) => (
  <span className={variant === "default" ? "badge" : `badge badge-${variant}`} title={title}>
    {children}
  </span>
);
