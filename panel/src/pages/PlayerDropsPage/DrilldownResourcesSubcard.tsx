import { useMemo } from "react";
import { numberToLocaleString } from "@/lib/utils";
import { PlayerDropsMessage } from "./PlayerDropsGenericSubcards";
import { t } from "@/lib/i18n";

type DisplayResourceDatum = {
    label: string;
    count: number;
}

type DrilldownResourcesSubcardProps = {
    resKicks: [string, number][];
};

export default function DrilldownResourcesSubcard({ resKicks }: DrilldownResourcesSubcardProps) {
    let { totalKicks, resources } = useMemo(() => {
        let totalKicks = 0;
        const resources: Record<string, DisplayResourceDatum> = {};
        for (const [resName, cnt] of resKicks) {
            totalKicks += cnt;
            resources[resName] = {
                label: resName,
                count: cnt,
            };
        }
        return {
            totalKicks,
            resources: Object.entries(resources),
        };
    }, [resKicks]);

    if (!resources.length) {
        return <PlayerDropsMessage message={t('No players kicked by resources within this time window.')} />;
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3 p-4 text-muted-foreground">
            {resources.map(([resName, resData]) => (
                <div
                    key={resName}
                    className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-black/[0.1] px-4 py-3"
                >
                    <span className="max-w-full truncate border-b border-white/10 pb-1 text-sm font-medium tracking-wide text-foreground">{resData.label}</span>
                    <span className="text-sm">
                        {numberToLocaleString(resData.count)} <small className="opacity-75">({numberToLocaleString((resData.count / totalKicks) * 100, 1)}%)</small>
                    </span>
                </div>
            ))}
        </div>
    );
}
