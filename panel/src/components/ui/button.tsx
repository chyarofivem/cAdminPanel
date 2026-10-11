import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Buttons follow docs/design-system.md:
 * - `default` is the primary action: one filled accent button per screen or section.
 * - `secondary` is everything else, including destructive actions on a page.
 * - `destructive` (filled red) is reserved for a confirmation dialog's confirm button.
 * - `link` is a text link in the accent text colour.
 * - `ghost` is a transparent control, mostly for icon-only buttons.
 * Buttons carry a label or an icon, never both.
 *
 * The other variant names are kept so older call sites keep compiling; they render
 * as the closest of the variants above.
 */
const secondary = "bg-raise-2 text-white hover:bg-raise-3"
const secondaryDanger = "bg-raise-2 text-danger-text hover:bg-raise-3"
const ghost = "bg-transparent text-body hover:bg-raise hover:text-white"

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[color,background-color,transform] duration-150 ease-in-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg-bottom disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default: "bg-accent text-white shadow-button hover:bg-accent-hover",
        secondary,
        destructive: "bg-danger text-white shadow-button hover:bg-danger/90",
        link: "h-auto min-h-0 rounded-xs px-0 py-0 text-accent-text hover:text-accent-glow hover:underline underline-offset-4 active:scale-100",
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
        "ghost-destructive": "bg-transparent text-danger-text hover:bg-raise",
      },
      size: {
        default: "min-h-11 px-5 py-2",
        lg: "min-h-11 px-5 py-2",
        //Toolbars on desktop. Phones keep the 44px touch target.
        sm: "min-h-11 px-4 py-1.5 text-dense sm:min-h-9",
        xs: "min-h-11 px-3 py-1 text-dense sm:min-h-8",
        inline: "h-6 px-2 text-xs",
        icon: "size-9 shrink-0 rounded-sm p-0 active:scale-100",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
