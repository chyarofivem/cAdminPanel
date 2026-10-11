import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLElement> & {
    children: React.ReactNode;
};

/**
 * Inline code chip: radius-xs on raise-2, monospace, inherits the surrounding font size.
 */
export default function InlineCode({ children, className, ...props }: Props) {
    return (
        <code
            className={cn("rounded-xs bg-raise-2 px-1 font-mono text-body", className)}
            {...props}
        >
            {children}
        </code>
    );
}
