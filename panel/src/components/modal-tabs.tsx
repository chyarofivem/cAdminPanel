import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import type { ScrollAreaProps } from "@radix-ui/react-scroll-area";

type StyledDivProps = JSX.IntrinsicElements["div"];

export type ModalTabInfo = {
    title: string;
    /** Deprecated: tab triggers carry no icons. Kept optional so older call sites compile. */
    icon?: JSX.Element;
    className?: string;
}

export function ModalContent({ children, className, ...props }: StyledDivProps & ScrollAreaProps) {
    return (
        <div className={cn('flex h-full flex-col md:flex-row md:px-4', className)} {...props}>
            {children}
        </div>
    );
}

/**
 * Tab list: the horizontal tab strip on phones, a plain vertical list from 768px.
 */
export function ModalTabsList({ children, className, ...props }: StyledDivProps & ScrollAreaProps) {
    return (
        <div className={cn('tx-tab-strip mx-2 flex flex-row gap-1 overflow-x-auto rounded-lg p-2 md:mx-0 md:flex-col md:overflow-visible md:bg-none md:p-0', className)} {...props}>
            {children}
        </div>
    );
}

export function ModalTabWrapper({ children, className, ...props }: StyledDivProps & ScrollAreaProps) {
    //FIXME: the number below is based off mobile screen sizes, and should be h-full while the modal content controls the actual height
    return (
        <ScrollArea className={cn('min-h-[16rem] w-full px-2 max-md:pt-3 md:max-h-[50vh] md:px-4', className)} {...props}>
            {children}
        </ScrollArea>
    );
}

export function ModalTabInner({ children, className, ...props }: StyledDivProps) {
    //NOTE: The padding is the minimum required for the input outlines not to get cropped
    return (
        <div className={cn('px-1 pb-1', className)} {...props}>
            {children}
        </div>
    );
}

/**
 * A tab-level message (loading, empty, permission): one line of muted text.
 */
export function ModalTabMessage({ children, className, ...props }: StyledDivProps) {
    return (
        <div className={cn('flex min-h-[16rem] items-center justify-center p-2 text-sm text-muted-foreground md:p-4', className)} {...props}>
            {children}
        </div>
    )
}
