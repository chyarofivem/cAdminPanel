import { useMemo } from "react";
import { numberToLocaleString } from "@/lib/utils";
import { PlayerDropsMessage } from "./PlayerDropsGenericSubcards";
import { playerDropCategories } from "@/lib/playerDropCategories";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";

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
                label: t(playerDropCategories[cat].label),
                tooltip: t(playerDropCategories[cat].description),
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
        return <PlayerDropsMessage message={t('No player drops within this time window.')} />;
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-6 gap-y-4">
            {categories.map(([reasonId, reasonData]) => (
                <Tooltip key={reasonId}>
                    <TooltipTrigger asChild>
                        <div className="min-w-0">
                            <p className="flex items-center gap-2 text-dense text-muted-foreground">
                                <span
                                    aria-hidden="true"
                                    className="size-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: reasonData.color }}
                                />
                                <span className="truncate">{reasonData.label}</span>
                            </p>
                            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                                {numberToLocaleString(reasonData.count)}{' '}
                                <span className="text-dense font-normal text-muted-foreground">
                                    ({numberToLocaleString((reasonData.count / totalDrops) * 100, 1)}%)
                                </span>
                            </p>
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
