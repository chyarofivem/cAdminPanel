import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"


const TabsVertical = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    orientation="vertical"
    className={cn(
      //TX CUSTOM: the enture root was just routed from radix
      'flex flex-row',
      className
    )}
    {...props}
  />
))
TabsVertical.displayName = TabsPrimitive.Root.displayName


const TabsVerticalList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex flex-col items-stretch gap-1 h-max",
      className
    )}
    {...props}
  />
))
TabsVerticalList.displayName = TabsPrimitive.List.displayName

const TabsVerticalTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex min-h-11 w-full items-center justify-start whitespace-nowrap rounded-md px-3.5 py-2 text-sm text-body transition-colors duration-150 hover:bg-raise hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-accent-soft data-[state=active]:text-accent-text",
      className
    )}
    {...props}
  />
))
TabsVerticalTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsVerticalContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "ml-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-full",
      className
    )}
    {...props}
  />
))
TabsVerticalContent.displayName = TabsPrimitive.Content.displayName

export { TabsVertical, TabsVerticalList, TabsVerticalTrigger, TabsVerticalContent }
