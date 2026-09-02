import { Fragment, useMemo } from "react";
import { PlayerDropsMessage } from "./PlayerDropsGenericSubcards";
import type { PDLChangeEventType } from "@shared/otherTypes";
import { processResourceChanges } from "./utils";
import { cn } from "@/lib/utils";
import { tsToLocaleDateString, tsToLocaleDateTimeString, tsToLocaleTimeString } from "@/lib/dateTime";
import { t } from "@/lib/i18n";


function DiffOld({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded px-1.5 py-0.5 font-mono text-xs text-primary dark:bg-destructive-inline/90 dark:text-background bg-destructive-inline/60">
            {children}
        </span>
    );
}
function DiffNew({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded px-1.5 py-0.5 font-mono text-xs text-primary dark:bg-success-inline/90 dark:text-background bg-success-inline/60">
            {children}
        </span>
    );
}
function DiffUpdated({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded px-1.5 py-0.5 font-mono text-xs text-primary dark:bg-warning/90 dark:text-background bg-warning/60">
            {children}
        </span>
    );
}

//The two version badges are spliced into the translated sentence so the whole
//phrase stays one dictionary key and translators can reorder it.
function SwitchedVersions({ oldVersion, newVersion }: { oldVersion: string; newVersion: string }) {
    return <>{t('Switched from {oldVersion} to {newVersion}')
        .split(/(\{oldVersion\}|\{newVersion\})/)
        .map((part, index) => {
            if (part === '{oldVersion}') return <DiffOld key={index}>{oldVersion}</DiffOld>;
            if (part === '{newVersion}') return <DiffNew key={index}>{newVersion}</DiffNew>;
            return part;
        })}</>;
}

type ChangedFxsEventProps = { change: Extract<PDLChangeEventType, { type: "fxsChanged" }> };
function ChangedFxsEvent({ change }: ChangedFxsEventProps) {
    return <SwitchedVersions oldVersion={change.oldVersion} newVersion={change.newVersion} />;
}

type ChangedGameEventProps = { change: Extract<PDLChangeEventType, { type: "gameChanged" }> };
function ChangedGameEvent({ change }: ChangedGameEventProps) {
    return <SwitchedVersions oldVersion={change.oldVersion} newVersion={change.newVersion} />;
}

type ChangedResourcesEventProps = { change: Extract<PDLChangeEventType, { type: "resourcesChanged" }> };
function ChangedResourcesEvent({ change }: ChangedResourcesEventProps) {
    const processedChanges = useMemo(() => {
        return processResourceChanges(change.resRemoved, change.resAdded);
    }, [change.resRemoved, change.resAdded]);

    let removedNode = null;
    if (processedChanges.removed.length) {
        removedNode = (<p>
            {t('Removed:')} {
                processedChanges.removed.map((item, index, array) => (
                    <Fragment key={item}>
                        <DiffOld>{item}</DiffOld>{index < array.length - 1 ? ', ' : '.'}
                    </Fragment>
                ))
            }
        </p>);
    }

    let addedNode = null;
    if (processedChanges.added.length) {
        addedNode = (<p>
            {t('Added:')} {
                processedChanges.added.map((item, index, array) => (
                    <Fragment key={item}>
                        <DiffNew>{item}</DiffNew>{index < array.length - 1 ? ', ' : '.'}
                    </Fragment>
                ))
            }
        </p>);
    }

    let updatedNode = null;
    if (processedChanges.updated.length) {
        updatedNode = (<p>
            {t('Updated:')} {
                processedChanges.updated.map((item, index, array) => (
                    <Fragment key={index}>
                        <DiffUpdated>{item.resName} {item.oldVer} -&gt; {item.newVer}</DiffUpdated>{index < array.length - 1 ? ', ' : '.'}
                    </Fragment>
                ))
            }
        </p>);
    }

    return (<>
        {removedNode}
        {addedNode}
        {updatedNode}
    </>);
}


type DrilldownChangesSubcardProps = {
    changes: PDLChangeEventType[];
};

export default function DrilldownChangesSubcard({ changes }: DrilldownChangesSubcardProps) {
    const eventTitles: Record<string, string> = {
        fxsChanged: t('Changed FXServer version'),
        gameChanged: t('Changed game version'),
        resourcesChanged: t('Changed boot resources'),
    };

    const sortedChanges = useMemo(() => {
        return [...changes].sort((a, b) => b.ts - a.ts);
    }, [changes]);

    if (!changes.length) {
        return <PlayerDropsMessage message={t('No environmental changes within this time window.')} />;
    }

    return (
        <div className="grid gap-3 p-4 md:grid-cols-[auto_minmax(0,1fr)]">
            {sortedChanges.map((change, index) => (
                <Fragment key={index}>
                    <div className="hidden items-start md:flex">
                        <div className="flex min-w-24 flex-col items-center justify-center rounded-lg border border-white/[0.06] bg-black/[0.1] px-2 py-2 text-xs font-medium text-muted-foreground">
                            <span>{tsToLocaleDateString(change.ts, 'medium')}</span>
                            <span>{tsToLocaleTimeString(change.ts)}</span>
                        </div>
                    </div>
                    <div
                        className={cn(
                            'col-span-2 flex-1 rounded-xl border border-white/[0.06] bg-black/[0.08] px-4 py-3 md:col-span-1',
                            index % 2 === 0 && 'bg-white/[0.025]',
                        )}
                    >
                        <div className="flex flex-wrap-reverse justify-between">
                            <h3 className="inline flex-grow text-sm font-semibold">
                                {change.type in eventTitles ? eventTitles[change.type] : change.type}
                            </h3>
                            <div className="md:hidden mx-auto">
                                <span className="border-muted-foreground border rounded px-2 py-0.5 font-normal text-xs text-muted-foreground">
                                    {tsToLocaleDateTimeString(change.ts, 'medium', 'short')}
                                </span>
                            </div>
                        </div>
                        <div className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                            {change.type === 'fxsChanged' && <ChangedFxsEvent change={change} />}
                            {change.type === 'gameChanged' && <ChangedGameEvent change={change} />}
                            {change.type === 'resourcesChanged' && <ChangedResourcesEvent change={change} />}
                        </div>
                    </div>
                </Fragment>
            ))}
        </div>
    );
}
