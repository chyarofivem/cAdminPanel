import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Buttons follow docs/design-system.md:
 * - `default` is the primary action: one filled accent button per view.
 * - `secondary` is everything else, including destructive actions on a page.
 * - `destructive` (filled red) is reserved for a confirmation dialog's confirm button.
 * - `link` is a text link in the accent text colour.
 * - `ghost` is a transparent control, mostly for icon-only buttons.
 * A button may carry a 16px icon before its label for create, download, upload,
 * start/stop or copy; most buttons stay text-only.
 *
 * Disabled buttons sit at 50% with a not-allowed cursor and no hover, so every
 * hover below is written for the enabled state only.
 *
 * The other variant names are kept so older call sites keep compiling; they render
 * as the closest of the variants above.
 */
const secondary = "bg-raise-2 text-white [&:not(:disabled):hover]:bg-raise-3"
const secondaryDanger = "bg-raise-2 text-danger-text [&:not(:disabled):hover]:bg-raise-3"
const ghost = "bg-transparent text-body [&:not(:disabled):hover]:bg-raise [&:not(:disabled):hover]:text-white"

const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium [transition:color_150ms_ease,background-color_150ms_ease,filter_150ms_ease,transform_100ms_ease] [&:not(:disabled):active]:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg-bottom disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-white shadow-button [&:not(:disabled):hover]:bg-accent-hover",
        secondary,
        destructive: "bg-danger text-white [&:not(:disabled):hover]:brightness-110",
        link: "h-auto min-h-0 rounded-xs px-0 py-0 text-accent-text [&:not(:disabled):hover]:text-accent-glow [&:not(:disabled):hover]:underline underline-offset-4 [&:not(:disabled):active]:scale-100",
        ghost,

        //Legacy names
        muted: secondary,
        outline: secondary,
        "outline-secondary": secondary,
        "outline-muted": secondary,
        "outline-info": secondary,
        "outline-success": secondary,
        "outline-warning": secondary,
        "outline-destructive": secondaryDanger,
        info: secondary,
        success: secondary,
        warning: secondary,
        "ghost-secondary": ghost,
        "ghost-muted": ghost,
        "ghost-info": ghost,
        "ghost-success": ghost,
        "ghost-warning": ghost,
        "ghost-destructive": "bg-transparent text-danger-text [&:not(:disabled):hover]:bg-raise",
      },
      size: {
        default: "min-h-11 px-5 py-2",
        lg: "min-h-11 px-5 py-2",
        //Toolbar controls are 36px on desktop. Phones keep the 44px touch target.
        sm: "min-h-11 px-4 py-1.5 text-dense sm:min-h-9",
        xs: "min-h-11 px-3 py-1 text-dense sm:min-h-8",
        inline: "h-6 px-2 text-xs",
        icon: "size-9 shrink-0 rounded-sm p-0 [&:not(:disabled):active]:scale-100",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Busy state: the button keeps its width, shows a 16px spinner in place of its
   * label and is disabled.
   */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={asChild ? disabled : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && !asChild ? <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 grid place-items-center">
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          </span>
        </> : <Slottable>{children}</Slottable>}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
