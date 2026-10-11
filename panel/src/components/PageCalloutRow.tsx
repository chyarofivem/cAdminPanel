import React from 'react';

function NumberLoading() {
    return (
        <div className="mt-1 h-6 w-28 rounded-xs bg-raise" />
    )
}


export type PageCalloutProps = {
    label: string;
    /** @deprecated Ignored: stat labels carry no icons. Kept so older call sites compile. */
    icon?: React.ReactNode;
    value: number | false;
    prefix?: string;
}

export type PageCalloutRowProps = {
    callouts: PageCalloutProps[];
};

/**
 * A row of four headline stats on one surface: muted label above a white value.
 * Values render as-is; no count-up animation.
 */
export default function PageCalloutRow({ callouts }: PageCalloutRowProps) {
    if (callouts.length !== 4) return null;

    return (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg bg-raise p-4 sm:p-6 lg:grid-cols-4">
            {callouts.map((callout, index) => (
                <div key={index} className="min-w-0">
                    <h3 className="truncate text-dense text-muted-foreground">{callout.label}</h3>
                    {callout.value === false ? (
                        <NumberLoading />
                    ) : (
                        <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                            {callout.prefix}{Math.floor(callout.value).toLocaleString("en-US")}
                        </p>
                    )}
                </div>
            ))}
        </div>
    )
}
