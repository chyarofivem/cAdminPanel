import * as React from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type IconButtonProps = Omit<ButtonProps, "size" | "children" | "aria-label"> & {
  /** Required: becomes both the aria-label and the tooltip. */
  label: string
  icon: React.ReactNode
  tooltipSide?: "top" | "right" | "bottom" | "left"
}

/**
 * The only icon-only control: 36x36, radius-sm, transparent, body-coloured icon that
 * turns white on a raise background when hovered. The label is mandatory so every
 * icon carries an aria-label and a tooltip.
 */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, tooltipSide, variant = "ghost", className, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          variant={variant}
          size="icon"
          aria-label={label}
          className={cn("[&_svg]:size-4", className)}
          {...props}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  )
)
IconButton.displayName = "IconButton"

export { IconButton }
