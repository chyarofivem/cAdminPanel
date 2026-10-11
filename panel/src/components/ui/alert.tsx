import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Callout: a tinted block with a 4px bar on the start edge, radius 0 16px 16px 0,
 * 24px padding (16px on phones). The bar is the one place a box may carry both a
 * fill and an edge.
 * - `default`/`accent` follows the accent.
 * - Status variants use their status colour and never follow the accent.
 */
const alertVariants = cva(
  "relative w-full rounded-r-lg border-l-4 p-4 text-sm text-white/60 sm:p-6",
  {
    variants: {
      variant: {
        default: "border-accent bg-accent-tint",
        accent: "border-accent bg-accent-tint",
        info: "border-info bg-info/15",
        success: "border-success bg-success/15",
        warning: "border-warning bg-warning/15",
        destructive: "border-danger bg-danger/15",
        danger: "border-danger bg-danger/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role={variant === "destructive" || variant === "danger" || variant === "warning" ? "alert" : "status"}
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 text-lg font-semibold leading-tight text-white/90", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm leading-normal text-white/60", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
