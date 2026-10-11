import { useId } from "react";
import { Label } from "./ui/label";
import { RadioGroupItem } from "./ui/radio-group";
import { DynamicNewBadge } from "./DynamicNewBadge";
import { cn } from "@/lib/utils";


type BigRadioItemProps = {
    value: string;
    title: string;
    desc: React.ReactNode;
    newOptionBadgeFeatName?: string;
    groupValue: string | undefined;
    disableReason?: string | null;
}

/**
 * A large radio option: an outlined row (hairline, accent edge when selected), never filled.
 */
export default function BigRadioItem(props: BigRadioItemProps) {
    const radioId = 'radio' + useId();
    const isDisabled = Boolean(props.disableReason);

    return (
        <div className="group">
            <Label
                htmlFor={radioId}
                className={cn(
                    "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-md p-3 font-normal ring-1 ring-inset ring-hairline transition-shadow duration-150 hover:ring-raise-3 data-[state=checked]:ring-2 data-[state=checked]:ring-accent-edge sm:p-4",
                    isDisabled && "cursor-not-allowed opacity-60 hover:ring-hairline"
                )}
                data-state={props.groupValue === props.value ? 'checked' : 'unchecked'}
                aria-disabled={isDisabled}
            >
                <RadioGroupItem value={props.value} id={radioId} disabled={isDisabled} />
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{props.title}</span>
                        {props.newOptionBadgeFeatName && (
                            <DynamicNewBadge
                                featName={props.newOptionBadgeFeatName}
                                size="md"
                                durationDays={28} //4 weeks
                            />
                        )}
                    </div>
                    <p className="text-dense text-muted-foreground">{props.desc}</p>
                    {props.disableReason && (
                        <p className="text-dense text-warning-text">{props.disableReason}</p>
                    )}
                </div>
            </Label>
        </div>
    )
}
