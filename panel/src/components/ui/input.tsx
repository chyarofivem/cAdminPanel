import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-white/10 bg-[#0f1116] px-3 py-2 text-sm text-white shadow-inner shadow-black/20 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-600 hover:border-white/20 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/20 disabled:cursor-not-allowed disabled:bg-white/[0.025] disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
