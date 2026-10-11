import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge: radius-sm, 4px x 8px, 12px/600. Neutral badges sit on raise-2.
 * A status badge uses the status text colour on a 15% tint of that status colour.
 * Status is never colour alone: the badge always carries a word.
 */
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-sm px-2 py-1 text-xs font-semibold leading-none",
  {
    variants: {
      variant: {
        default: "bg-raise-2 text-badge",
        secondary: "bg-raise-2 text-badge",
        outline: "bg-raise-2 text-badge",
        accent: "bg-accent text-white",
        success: "bg-success/15 text-success-text",
        warning: "bg-warning/15 text-warning-text",
        danger: "bg-danger/15 text-danger-text",
        destructive: "bg-danger/15 text-danger-text",
        info: "bg-info/15 text-info-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
