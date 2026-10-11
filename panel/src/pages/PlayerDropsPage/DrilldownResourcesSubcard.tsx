import { useMemo } from "react";
import { numberToLocaleString } from "@/lib/utils";
import { ListRow, ListRows } from "@/components/ListRow";
import EmptyState from "@/components/EmptyState";
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
        return <EmptyState message={t('No players kicked by resources within this time window.')} />;
    }

    return (
        <ListRows>
            {resources.map(([resName, resData]) => (
                <ListRow key={resName} className="justify-between">
                    <span className="min-w-0 truncate font-mono text-dense text-white" title={resData.label}>
                        {resData.label}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-white">
                        {numberToLocaleString(resData.count)}{' '}
                        <span className="text-dense text-muted-foreground">
                            ({numberToLocaleString((resData.count / totalKicks) * 100, 1)}%)
                        </span>
                    </span>
                </ListRow>
            ))}
        </ListRows>
    );
}
