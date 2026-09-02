import { useMemo } from "react";
import { cn, numberToLocaleString } from "@/lib/utils";
import { PlayerDropsMessage } from "./PlayerDropsGenericSubcards";
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
    isOdd: boolean;
    isLast: boolean;
};

function CrashTypeRow({ datum, isLast, isOdd }: CrashTypeRowProps) {
    let dataCellNode = null;
    if (datum.prefix) {
        dataCellNode = <>
            <span className="text-muted-foreground/50">{datum.prefix}</span>
            <span>{datum.suffix}</span>
        </>
    } else {
        dataCellNode = datum.suffix;
    }

    return (
        <tr
            className={cn(
                'font-mono text-sm group',
                !isLast && 'border-b',
                isOdd && 'bg-secondary/15',
                'hover:bg-secondary/35'
            )}
        >
            <td className="min-w-[4ch] px-2 py-1 border-r text-right" title={t('Percent of all crashes')}>
                {datum.pctStr ?? '--'}
            </td>
            <td className="min-w-[4ch] px-2 py-1 border-r text-right" title={t('Crash count')}>
                {datum.cntStr ?? '--'}
            </td>
            <td className="px-2 py-1 attempt-word-wrap line-clamp-4">
                {dataCellNode}
            </td>
        </tr>
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
        return <PlayerDropsMessage message={t('No player crashes within this time window.')} />;
    }

    return (
        <div className="overflow-x-auto p-4 pt-3">
        <table className="w-full overflow-hidden rounded-xl border border-white/[0.06]">
            <thead>
                <tr className="border-b border-white/[0.06] bg-black/[0.12] text-xs uppercase tracking-wider text-muted-foreground/75">
                    <th className="min-w-[4ch] border-r border-white/[0.06] px-3 py-2 text-right">%</th>
                    <th className="min-w-[4ch] border-r border-white/[0.06] px-3 py-2 text-right">{t('Count')}</th>
                    <th className="px-3 py-2 text-left">{t('Crash Reason')}</th>
                </tr>
            </thead>
            <tbody>
                {crashesData.display.map((datum, index) => (
                    <CrashTypeRow
                        key={datum.key}
                        datum={datum}
                        isOdd={index % 2 === 0}
                        isLast={!crashesData.filteredOut && index === crashesData.display.length - 1}
                    />
                ))}
                {crashesData.filteredOut ? (
                    <tr>
                        <td
                            colSpan={3}
                            className={cn(
                                'text-center px-4 py-2 text-muted-foreground',
                                crashesData.display.length % 2 === 0 && 'bg-secondary/15',
                                'hover:bg-secondary/35'
                            )}
                        >
                            {t('Showing the top {shown} out of {total} reasons which account for {percent} of all crashes.', {
                                shown: crashesData.display.length,
                                total: numberToLocaleString(crashTypes.length),
                                percent: crashesData.displayPct,
                            })} <br />
                            {t('The remaining {count} reasons account for {percent} of all crashes.', {
                                count: numberToLocaleString(crashesData.filteredOut.types),
                                percent: crashesData.filteredOut.countPct,
                            })} {' '}
                            <button
                                className="text-accent hover:underline"
                                onClick={() => setCrashesTargetLimit(0)}
                            >
                                {t('Show All!')}
                            </button>
                        </td>
                    </tr>
                ) : null}
            </tbody>
        </table>
        </div>
    );
}
