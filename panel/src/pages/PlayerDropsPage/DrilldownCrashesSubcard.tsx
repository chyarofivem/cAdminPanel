import { useMemo } from "react";
import { numberToLocaleString } from "@/lib/utils";
import { ListRow, ListRows } from "@/components/ListRow";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { compressMultipleCounter, splitPrefixedStrings } from "./utils";
import { t } from "@/lib/i18n";


type CrashDatumData = {
    key: string;
    pctStr: string;
    cntStr: string;
    prefix: string | false;
    suffix: string;
};

type CrashTypeRowProps = {
    datum: CrashDatumData;
};

function CrashTypeRow({ datum }: CrashTypeRowProps) {
    let dataCellNode = null;
    if (datum.prefix) {
        dataCellNode = <>
            <span className="text-muted-foreground">{datum.prefix}</span>
            <span>{datum.suffix}</span>
        </>
    } else {
        dataCellNode = datum.suffix;
    }

    return (
        <ListRow className="items-start justify-between gap-4">
            <p className="attempt-word-wrap line-clamp-4 min-w-0 flex-1 font-mono text-dense text-body">
                {dataCellNode}
            </p>
            <div className="shrink-0 text-right tabular-nums">
                <p className="text-sm font-medium text-white" title={t('Percent of all crashes')}>
                    {datum.pctStr ?? '--'}
                </p>
                <p className="text-dense text-muted-foreground" title={t('Crash count')}>
                    {datum.cntStr ?? '--'}
                </p>
            </div>
        </ListRow>
    );
}


type DrilldownCrashesSubcardProps = {
    crashTypes: [reasonType: string, count: number][];
    crashesGroupReasons: boolean;
    crashesTargetLimit: number;
    setCrashesTargetLimit: (limit: number) => void;
};

export default function DrilldownCrashesSubcard({
    crashTypes,
    crashesGroupReasons,
    crashesTargetLimit,
    setCrashesTargetLimit
}: DrilldownCrashesSubcardProps) {
    const crashesData = useMemo(() => {
        const sortedCrashTypes = [...crashTypes];
        // Sort a display copy so API state stays immutable.
        if (crashesGroupReasons) {
            sortedCrashTypes.sort((a, b) => a[0].localeCompare(b[0]));
        } else {
            sortedCrashTypes.sort((a, b) => b[1] - a[1]);
        }

        //Calculate the total crashes and compress the data
        const totalCrashes = sortedCrashTypes.reduce((acc, [, cnt]) => acc + cnt, 0);
        const { filteredIn, filteredOut } = crashesTargetLimit
            ? compressMultipleCounter(sortedCrashTypes, crashesTargetLimit, crashesGroupReasons)
            : { filteredIn: sortedCrashTypes, filteredOut: false as const };
        const processedStrings = splitPrefixedStrings(filteredIn.map(([str, cnt]) => str));

        //Prepare the display data
        const display: CrashDatumData[] = [];
        let displayCrashCount = 0;
        for (let i = 0; i < filteredIn.length; i++) {
            const [crashType, crashCount] = filteredIn[i];
            displayCrashCount += crashCount;
            const fraction = (crashCount / totalCrashes);
            display.push({
                key: crashType,
                pctStr: numberToLocaleString(fraction * 100, 1) + '%',
                cntStr: numberToLocaleString(crashCount),
                ...processedStrings[i],
            });
        }
        return {
            display,
            displayPct: numberToLocaleString((displayCrashCount / totalCrashes) * 100, 1) + '%',
            filteredOut: filteredOut && {
                ...filteredOut,
                countPct: numberToLocaleString((filteredOut.count / totalCrashes) * 100, 1) + '%',
            }
        };

    }, [crashTypes, crashesGroupReasons, crashesTargetLimit, setCrashesTargetLimit]);

    //Kept after the memo so the hook order never changes between renders.
    if (!crashTypes.length) {
        return <EmptyState message={t('No player crashes within this time window.')} />;
    }

    return (
        <div className="flex flex-col gap-3">
            <ListRows>
                {crashesData.display.map((datum) => (
                    <CrashTypeRow key={datum.key} datum={datum} />
                ))}
            </ListRows>
            {crashesData.filteredOut ? (
                <p className="text-dense text-muted-foreground">
                    {t('Showing the top {shown} out of {total} reasons which account for {percent} of all crashes.', {
                        shown: crashesData.display.length,
                        total: numberToLocaleString(crashTypes.length),
                        percent: crashesData.displayPct,
                    })}{' '}
                    {t('The remaining {count} reasons account for {percent} of all crashes.', {
                        count: numberToLocaleString(crashesData.filteredOut.types),
                        percent: crashesData.filteredOut.countPct,
                    })}{' '}
                    <Button
                        variant="link"
                        className="text-dense"
                        onClick={() => setCrashesTargetLimit(0)}
                    >
                        {t('Show All!')}
                    </Button>
                </p>
            ) : null}
        </div>
    );
}
