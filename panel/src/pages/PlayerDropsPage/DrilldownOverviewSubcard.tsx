import { useMemo } from "react";
import { numberToLocaleString } from "@/lib/utils";
import { PlayerDropsMessage } from "./PlayerDropsGenericSubcards";
import { playerDropCategories } from "@/lib/playerDropCategories";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type DisplayCategoryDatum = {
    label: string;
    tooltip: string;
    color: string;
    count: number;
}

type DrilldownOverviewSubcardProps = {
    dropTypes: [string, number][];
};

export default function DrilldownOverviewSubcard({ dropTypes }: DrilldownOverviewSubcardProps) {
    let { totalDrops, categories } = useMemo(() => {
        let totalDrops = 0;
        const categories: Record<string, DisplayCategoryDatum> = {};
        for (const [cat, cnt] of dropTypes) {
            totalDrops += cnt;
            if (!(cat in playerDropCategories)) continue;
            categories[cat] = {
                label: playerDropCategories[cat].label,
                tooltip: playerDropCategories[cat].description,
                color: playerDropCategories[cat].color,
                count: cnt,
            };
        }
        return {
            totalDrops,
            categories: Object.entries(categories),
        };
    }, [dropTypes]);

    if (!categories.length) {
        return <PlayerDropsMessage message="No player drops within this time window." />;
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 p-4 text-muted-foreground">
            {categories.map(([reasonId, reasonData]) => (
                <Tooltip key={reasonId}>
                    <TooltipTrigger asChild>
                        <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-black/[0.1] px-4 py-3 transition-colors hover:bg-white/[0.035]">
                            <span
                                className="border-b-2 pb-1 text-base font-semibold tracking-wide text-foreground"
                                style={{ borderColor: reasonData.color }}
                            >{reasonData.label}</span>
                            <span className="text-sm">
                                {numberToLocaleString(reasonData.count)} <small className="opacity-75">({numberToLocaleString((reasonData.count / totalDrops) * 100, 1)}%)</small>
                            </span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-96 text-center">
                        <p>{reasonData.tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            ))}
        </div>
    );
}
