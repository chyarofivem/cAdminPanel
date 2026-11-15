import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Callout: the card's shape (radius-lg, 16px padding) with one flat fill that carries
 * the meaning. No border, no start-edge bar, no ring, no shadow.
 * - `default`/`accent` sits on accent-soft and follows the accent.
 * - Status variants sit on a 10% tint of their status colour and never follow the accent.
 * - `neutral` sits on raise.
 * Only the fill and the optional 24px status icon take the colour; the heading is
 * 14px/600 white and the body 14px muted, both on a 20px line, 4px apart.
 *
 * The icon is positioned in the start padding so call sites keep full control of the
 * callout's own layout (a flex row with a retry button, for example).
 */
const alertVariants = cva(
  "relative w-full rounded-lg p-4 text-sm leading-5 text-muted-foreground",
  {
    variants: {
      variant: {
        default: "bg-accent-soft",
        accent: "bg-accent-soft",
        neutral: "bg-raise",
        info: "bg-info/10",
        success: "bg-success/10",
        warning: "bg-warning/10",
        destructive: "bg-danger/10",
        danger: "bg-danger/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>

//check = success, triangle = warning, circle-x = error, circle-i = info.
const statusIcons: Partial<Record<AlertVariant, React.ReactNode>> = {
  info: <InfoIcon className="text-info-text" />,
  success: <CircleCheckIcon className="text-success-text" />,
  warning: <TriangleAlertIcon className="text-warning-text" />,
  destructive: <CircleXIcon className="text-danger-text" />,
  danger: <CircleXIcon className="text-danger-text" />,
}

type AlertProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & {
  /**
   * The 24px status icon at the start. Status variants show theirs by default;
   * pass `false` to hide it, or an icon for an accent or neutral callout.
   */
  icon?: React.ReactNode | false
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, children, ...props }, ref) => {
    const resolvedIcon = icon === false ? null : icon ?? statusIcons[variant ?? "default"] ?? null
    return (
      <div
        ref={ref}
        role={variant === "destructive" || variant === "danger" || variant === "warning" ? "alert" : "status"}
        className={cn(alertVariants({ variant }), resolvedIcon && "pl-[3.25rem]", className)}
        {...props}
      >
        {resolvedIcon && (
          <span aria-hidden="true" className="absolute left-4 top-3.5 flex text-body [&_svg]:size-6">
            {resolvedIcon}
          </span>
        )}
        {children}
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 text-sm font-semibold leading-5 text-white", className)}
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
    className={cn("text-sm leading-5 text-muted-foreground", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
