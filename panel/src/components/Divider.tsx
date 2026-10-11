type DividerProps = {
    text?: string;
};

/**
 * Hairline divider with an optional muted label in the middle.
 */
export default function Divider({ text }: DividerProps) {
    return (
        <div className="flex w-full flex-nowrap items-center justify-center gap-3" role="separator">
            <div className="grow border-b border-hairline" />
            {text && <div className="flex justify-center text-xs text-muted-foreground">
                {text}
            </div>}
            {text && <div className="grow border-b border-hairline" />}
        </div>
    )
}
