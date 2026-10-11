import { cn } from "@/lib/utils";
import { Switch } from "./ui/switch";
import { forwardRef } from 'react';

/**
 * Legacy colour variants. The design system puts every toggle's on-state on the accent
 * (docs/design-system.md), so these names are kept for older call sites and all render
 * the default switch.
 */
type SwitchTextVariant =
    | 'default'
    | 'checkedGreen'
    | 'checkedYellow'
    | 'checkedRed'
    | 'uncheckedGreen'
    | 'uncheckedYellow'
    | 'uncheckedRed'
    | 'redGreen'
    | 'greenRed';


type SwitchTextProps = Omit<Parameters<typeof Switch>[0], 'children'> & {
    checkedLabel: string;
    uncheckedLabel: string;
    className?: string;
    variant?: SwitchTextVariant | null;
};

/**
 * A switch followed by a word that names its current state ("Enabled", "Hidden"),
 * so the state is never shown by colour alone.
 */
const SwitchText = forwardRef<
    React.ElementRef<typeof Switch>,
    SwitchTextProps
>(({
    id,
    checkedLabel,
    uncheckedLabel,
    variant: _variant,
    className,
    ...props
}, ref) => {
    return (
        <div className="flex min-h-6 items-center gap-3">
            <Switch
                id={id}
                className={cn('peer', className)}
                ref={ref}
                {...props}
            />
            <span className="hidden select-none text-sm text-body peer-data-[state=checked]:inline">
                {checkedLabel}
            </span>
            <span className="hidden select-none text-sm text-body peer-data-[state=unchecked]:inline">
                {uncheckedLabel}
            </span>
        </div>
    )
});

SwitchText.displayName = 'SwitchText';

export default SwitchText;
