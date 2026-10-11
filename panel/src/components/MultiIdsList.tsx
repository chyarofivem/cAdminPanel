import { txToast } from "@/components/TxToaster";
import { cn, copyToClipboard } from "@/lib/utils";
import { CopyIcon, ListTodoIcon, Trash2Icon, UndoIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOpenPromptDialog } from "@/hooks/dialogs";
import { shortenId } from "@shared/utils";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { IconButton } from "./ui/icon-button";
import EmptyState from "./EmptyState";
import { ListRow, ListRows } from "./ListRow";
import { t } from '@/lib/i18n';


//MARK: Helpers
//To help ctrl+c'ing with the list selected
const InvisibleNewLine = () => <span className="opacity-0">{'\n'}</span>;

//Sort IDs prioritizing license IDs
const sortIds = (a: string, b: string) => {
    const getPriority = (id: string) => {
        if (id.startsWith('license:')) return 0;
        if (id.startsWith('license2:')) return 1;
        return 2;
    };

    const aPriority = getPriority(a);
    const bPriority = getPriority(b);

    // If same priority, sort alphabetically
    if (aPriority === bPriority) {
        return a.localeCompare(b);
    }

    // Otherwise sort by priority
    return aPriority - bPriority;
};

//Used in the compare prompt dialog
const placeholderIds = [
    'fivem:xxxxxxx',
    'license:xxxxxxxxxxxxxx',
    'discord:xxxxxxxxxxxxxxxxxx',
    'etc...',
].join('\n');
const placeholderHwids = [
    '2:xxxxxxxxxxxxxx...',
    '4:xxxxxxxxxxxxxx...',
    '5:xxxxxxxxxxxxxx...',
    'etc...',
].join('\n');


//MARK: IdLine
type IdLineProps = {
    id: string;
    displayShortenedId: boolean;
    isOnline: boolean;
    highlightOnline: boolean;
    onCopy?: () => void;
    isComparing: boolean;
    isMatch: boolean;
    isRemoving: boolean;
    isMarkedForRemoval?: boolean;
    toggleMarkRemoval?: () => void;
    disableButtons: boolean;
}

function IdLine({
    id,
    displayShortenedId,
    onCopy,
    isOnline,
    highlightOnline,
    isComparing,
    isMatch,
    isRemoving,
    isMarkedForRemoval,
    toggleMarkRemoval,
    disableButtons,
}: IdLineProps) {
    const canBeRemoved = !id.startsWith('license:') && !isOnline; // Only allow removal of old IDs
    const isBold = (isComparing && isMatch)
        || (!isComparing && !highlightOnline)
        || (!isComparing && highlightOnline && isOnline);
    return (
        <ListRow className="gap-2 py-1 pl-4 pr-1 sm:pl-4 sm:pr-1">
            <span
                className={cn(
                    'min-w-0 flex-1 break-all font-mono text-dense',
                    isBold ? 'text-white' : 'text-muted-foreground',
                    isComparing && isMatch && 'text-success-text',
                    isMarkedForRemoval && 'line-through text-danger-text',
                )}
                title={displayShortenedId ? id : undefined}
            >
                {displayShortenedId ? shortenId(id, 20) : id}<InvisibleNewLine />
            </span>
            {isRemoving ? canBeRemoved && (
                <IconButton
                    label={isMarkedForRemoval ? t('Undo mark for deletion') : t('Mark for deletion')}
                    icon={isMarkedForRemoval ? <UndoIcon /> : <Trash2Icon />}
                    variant={isMarkedForRemoval ? 'ghost' : 'ghost-destructive'}
                    onClick={toggleMarkRemoval}
                    disabled={disableButtons}
                />
            ) : (
                <IconButton
                    label={t('Copy to clipboard')}
                    icon={<CopyIcon />}
                    onClick={onCopy}
                    disabled={disableButtons}
                />
            )}
        </ListRow>
    );
}


//MARK: IdListControls
type IdListControlsProps = {
    hasRemoveIds: boolean;
    canRemoveIds?: boolean;
    handleStartMarkRemoval: () => void;
    handleCompareIds: () => void;
    handleCopyAllIds: () => void;
    typeStr: string;
}

function IdListControls({
    hasRemoveIds,
    canRemoveIds,
    handleStartMarkRemoval,
    handleCompareIds,
    handleCopyAllIds,
    typeStr,
}: IdListControlsProps) {
    return (
        <>
            {hasRemoveIds && (
                <IconButton
                    label={canRemoveIds
                        ? t('Mark {type}s for deletion.', { type: `${typeStr}s` })
                        : t('You do not have permission to remove {type}s.', { type: `${typeStr}s` })}
                    icon={<Trash2Icon />}
                    onClick={handleStartMarkRemoval}
                    disabled={!canRemoveIds}
                />
            )}
            <IconButton
                label={t('Compare {type}s', { type: typeStr })}
                icon={<ListTodoIcon />}
                onClick={handleCompareIds}
            />
            <IconButton
                label={t('Copy all {type}s', { type: typeStr })}
                icon={<CopyIcon />}
                onClick={handleCopyAllIds}
            />
        </>
    )
}


//MARK: Main Component
type ActionFeedback = {
    msg: string;
    type: 'green' | 'yellow' | 'red';
}

type MultiIdsListProps = {
    idsOnline?: string[];
    idsOffline: string[];
    type: 'hwid' | 'id';
    src: 'player' | 'action';
    isHwids?: boolean;
    onRemoveIds?: (
        ids: string[],
        onError: () => void,
    ) => void;
    canRemoveIds?: boolean;
}

export default function MultiIdsList({ idsOnline, idsOffline, type, src, onRemoveIds, canRemoveIds }: MultiIdsListProps) {
    const openPromptDialog = useOpenPromptDialog();
    const divRef = useRef<HTMLDivElement>(null);
    const [compareMatches, setCompareMatches] = useState<string[] | null>(null);
    const [markedForRemoval, setMarkedForRemoval] = useState<string[] | null>(null);
    const [actionFeedback, setActionFeedback] = useState<ActionFeedback | false>(false);
    const [isCommittingDeletions, setIsCommittingDeletions] = useState(false);

    const handleClearState = () => {
        setCompareMatches(null);
        setMarkedForRemoval(null);
        setActionFeedback(false);
        setIsCommittingDeletions(false);
    }

    const hasAnyIdAvailable = idsOnline?.length || idsOffline.length;
    const hasAnyIdOnline = Array.isArray(idsOnline) && !!idsOnline.length;
    const allIds = useMemo(() => {
        const ids: string[] = [];
        idsOnline?.slice().sort(sortIds).forEach((id) => {
            if (!ids.includes(id)) ids.push(id);
        });
        idsOffline.slice().sort(sortIds).forEach((id) => {
            if (!ids.includes(id)) ids.push(id);
        });
        return ids;
    }, [idsOnline, idsOffline]);

    const isHwids = type === 'hwid';
    const typeStr = isHwids ? 'HWID' : 'ID';
    const getPluralizedType = (count: number) => count === 1 ? typeStr : `${typeStr}s`;
    const emptyMessage = t('This {source} has no {type}s.', { source: t(src), type: `${typeStr}s` });
    const isInCompareMode = Array.isArray(compareMatches);
    const isCompareIdMatch = (id: string) => isInCompareMode && compareMatches.includes(id);
    const isInRemovalMode = Array.isArray(markedForRemoval);
    const isMarkedForRemoval = (id: string) => isInRemovalMode && markedForRemoval.includes(id);

    //The feedback message replaces the controls for a moment, without any entrance animation.
    useEffect(() => {
        if (!actionFeedback) return;
        const timer = setTimeout(() => {
            setActionFeedback(false);
        }, 2750);
        return () => clearTimeout(timer);
    }, [actionFeedback, isInCompareMode, isInRemovalMode]);


    const handleStartMarkRemoval = () => {
        if (!hasAnyIdAvailable) {
            txToast.warning(t('There are no {type}s to remove.', { type: typeStr }));
            return;
        }
        if (!idsOffline.length) {
            txToast.warning(t('Only inactive {type}s can be removed, and every one in this list is currently active.', { type: typeStr }));
            return;
        }
        setMarkedForRemoval([]);
    }

    const toggleMarkRemoval = (id: string) => {
        console.log(`toggleMarkRemoval(${id})`, markedForRemoval);
        if (!isInRemovalMode) return;
        setMarkedForRemoval((prev) => {
            if (!prev) return [id];
            if (prev.includes(id)) {
                return prev.filter((i) => i !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const handleCommitRemoval = () => {
        if (!onRemoveIds || !isInRemovalMode || !markedForRemoval?.length) return;
        setActionFeedback({
            msg: t('Saving...'),
            type: 'yellow',
        });
        setIsCommittingDeletions(true);
        onRemoveIds(markedForRemoval, () => {
            //We don't need to handle success cases because the modal refreshes
            setIsCommittingDeletions(false);
            setActionFeedback({
                msg: t('Error'),
                type: 'red',
            });
        });
    }

    const handleCompareIds = () => {
        openPromptDialog({
            title: t('Compare {type}s', { type: typeStr }),
            message: t('Paste a list to compare with the current list. Separate values with a new line or comma.'),
            placeholder: isHwids ? placeholderHwids : placeholderIds,
            submitLabel: t('Compare'),
            required: true,
            isMultiline: true,
            isWide: true,
            onSubmit: (input) => {
                const cleanIds = input
                    .split(/[\n\s,;]+/)
                    .map((id) => id.trim())
                    .filter((id) => id.length && allIds.includes(id));
                setCompareMatches(cleanIds);
            }
        });
    };

    const handleCopyString = (strToCopy: string) => {
        if (!divRef.current) throw new Error(`divRef.current undefined`);
        copyToClipboard(strToCopy, divRef.current).then((res) => {
            if (res !== false) {
                setActionFeedback({
                    msg: t('Copied!'),
                    type: 'green',
                });
            } else {
                txToast.error(t('Failed to copy to clipboard.'));
            }
        }).catch((error) => {
            txToast.error({
                title: t('Failed to copy to clipboard.'),
                msg: error.message,
            });
            setActionFeedback({
                msg: t('Error'),
                type: 'red',
            });
        });
    }

    const handleCopyAllIds = () => {
        if (!divRef.current) throw new Error(`divRef.current undefined`);
        if (!hasAnyIdAvailable) return;
        handleCopyString(allIds.join('\r\n'));
    }
    const handleCopySingleId = (id: string) => {
        if (!divRef.current) throw new Error(`divRef.current undefined`);
        if (!id) return;
        handleCopyString(id);
    }

    return <div className="flex flex-col gap-3">
        <div className="flex min-h-9 items-center justify-between gap-3" ref={divRef}>
            <h3 className="text-base font-semibold text-white">
                {isHwids ? t('Hardware IDs') : t('Player Identifiers')}
                {isInCompareMode && compareMatches.length ? (
                    <span className="ml-2 text-sm font-normal text-success-text">
                        ({t('{count} matches found', { count: compareMatches.length })})
                    </span>
                ) : null}
            </h3>
            <div
                className={cn(
                    'flex shrink-0 items-center justify-end gap-1',
                    !hasAnyIdAvailable && 'hidden'
                )}
            >
                {actionFeedback ? (
                    <span
                        role="status"
                        className={cn(
                            "pointer-events-none select-none text-sm",
                            actionFeedback.type === 'green' && "text-success-text",
                            actionFeedback.type === 'yellow' && "text-warning-text",
                            actionFeedback.type === 'red' && "text-danger-text",
                        )}
                    >
                        {actionFeedback.msg}
                    </span>
                ) : isInCompareMode ? (
                    <Button size="xs" variant="secondary" onClick={handleClearState}>
                        {t('Clear')}
                    </Button>
                ) : isInRemovalMode ? (
                    <Button size="xs" variant="secondary" onClick={handleClearState}>
                        {t('Cancel')}
                    </Button>
                ) : (
                    <IdListControls
                        hasRemoveIds={!!onRemoveIds}
                        canRemoveIds={canRemoveIds}
                        handleStartMarkRemoval={handleStartMarkRemoval}
                        handleCompareIds={handleCompareIds}
                        handleCopyAllIds={handleCopyAllIds}
                        typeStr={typeStr}
                    />
                )}
            </div>
        </div>
        {isInCompareMode && !compareMatches.length && (
            <p role="status" className="text-sm text-warning-text">{t('No matching {type} found.', { type: typeStr })}</p>
        )}
        {!hasAnyIdAvailable ? (
            <EmptyState message={emptyMessage} />
        ) : (
            <ListRows className="gap-1">
                {allIds.map((id) => (
                    <IdLine
                        key={id}
                        id={id}
                        displayShortenedId={isHwids}
                        onCopy={() => handleCopySingleId(id)}
                        isOnline={idsOnline?.includes(id) ?? false}
                        highlightOnline={hasAnyIdOnline}
                        isComparing={isInCompareMode}
                        isMatch={isCompareIdMatch(id)}
                        isRemoving={isInRemovalMode}
                        isMarkedForRemoval={isMarkedForRemoval(id)}
                        toggleMarkRemoval={() => toggleMarkRemoval(id)}
                        disableButtons={isCommittingDeletions}
                    />
                ))}
            </ListRows>
        )}
        {isInRemovalMode && (
            <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-3">
                <span className="text-sm font-medium text-white">
                    {markedForRemoval.length
                        ? t('Permanently delete {count} {type}?', { count: markedForRemoval.length, type: getPluralizedType(markedForRemoval.length) })
                        : t('Click above to mark IDs for deletion.')}
                </span>
                {markedForRemoval.length ? (
                    <Button
                        size="xs"
                        variant="outline-destructive"
                        onClick={handleCommitRemoval}
                        title={t('Confirm removal of marked {type}s.', { type: typeStr })}
                        disabled={isCommittingDeletions}
                    >
                        {isCommittingDeletions ? t('Saving...') : t('Confirm & Delete')}
                    </Button>
                ) : null}
            </Alert>
        )}
    </div>
}
