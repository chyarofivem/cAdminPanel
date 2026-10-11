import { Fragment, useMemo } from "react";
import type { PDLChangeEventType } from "@shared/otherTypes";
import { processResourceChanges } from "./utils";
import { tsToLocaleDateString, tsToLocaleDateTimeString, tsToLocaleTimeString } from "@/lib/dateTime";
import { ListRow, ListRows } from "@/components/ListRow";
import EmptyState from "@/components/EmptyState";
import { t } from "@/lib/i18n";


//Diff chips use the status tints. The words around them ("Removed:", "Added:", "Updated:",
//"Switched from ... to ...") carry the meaning, so colour is never the only signal.
function DiffOld({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-xs bg-danger/15 px-1.5 py-0.5 font-mono text-xs text-danger-text">
            {children}
        </span>
    );
}
function DiffNew({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-xs bg-success/15 px-1.5 py-0.5 font-mono text-xs text-success-text">
            {children}
        </span>
    );
}
function DiffUpdated({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-xs bg-warning/15 px-1.5 py-0.5 font-mono text-xs text-warning-text">
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
        return <EmptyState message={t('No environmental changes within this time window.')} />;
    }

    return (
        <ListRows>
            {sortedChanges.map((change, index) => (
                <ListRow key={index} className="items-start gap-4">
                    <div className="hidden w-28 shrink-0 flex-col text-dense tabular-nums text-muted-foreground md:flex">
                        <span>{tsToLocaleDateString(change.ts, 'medium')}</span>
                        <span>{tsToLocaleTimeString(change.ts)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-white">
                            {change.type in eventTitles ? eventTitles[change.type] : change.type}
                        </h3>
                        <p className="text-dense tabular-nums text-muted-foreground md:hidden">
                            {tsToLocaleDateTimeString(change.ts, 'medium', 'short')}
                        </p>
                        <div className="mt-1 break-words text-dense leading-6 text-body">
                            {change.type === 'fxsChanged' && <ChangedFxsEvent change={change} />}
                            {change.type === 'gameChanged' && <ChangedGameEvent change={change} />}
                            {change.type === 'resourcesChanged' && <ChangedResourcesEvent change={change} />}
                        </div>
                    </div>
                </ListRow>
            ))}
        </ListRows>
    );
}
