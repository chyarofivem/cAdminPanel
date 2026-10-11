import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const DropDownSelect = SelectPrimitive.Root

const DropDownSelectValue = SelectPrimitive.Value

const DropDownSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ children }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    asChild
  >
    {children}
  </SelectPrimitive.Trigger>
))
DropDownSelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const DropDownSelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
DropDownSelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const DropDownSelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
DropDownSelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const DropDownSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        //Same as the Select menu: menu surface, radius-xs, hairline dividers, menu shadow, no zoom or slide.
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xs bg-menu text-body shadow-menu",
        position === "popper" &&
        "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <DropDownSelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "divide-y divide-hairline",
          position === "popper" &&
          "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <DropDownSelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
DropDownSelectContent.displayName = SelectPrimitive.Content.displayName


const DropDownSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-11 w-full cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm outline-none transition-colors duration-150 focus:bg-raise focus:text-white data-[state=checked]:text-accent-text data-[disabled]:pointer-events-none data-[disabled]:opacity-50 sm:min-h-10",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
DropDownSelectItem.displayName = SelectPrimitive.Item.displayName

export {
  DropDownSelect,
  DropDownSelectValue,
  DropDownSelectTrigger,
  DropDownSelectItem,
  DropDownSelectContent,
  DropDownSelectScrollUpButton,
  DropDownSelectScrollDownButton,
}
