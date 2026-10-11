import { txToast } from "@/components/TxToaster";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ListRow, ListRows } from "@/components/ListRow";
import EmptyState from "@/components/EmptyState";
import { useOpenPromptDialog } from "@/hooks/dialogs";
import { useLiveConsoleBookmarks, useLiveConsoleHistory } from "@/pages/LiveConsole/liveConsoleHooks";
import { cn } from "@/lib/utils";
import { StarIcon, StarOffIcon, XIcon } from "lucide-react";
import { t } from '@/lib/i18n';


type SheetProps = {
    isOpen: boolean;
    closeSheet: () => void;
    toTermInput: (_cmd: string) => void;
}

//Black 60% backdrop, no blur. Shown and hidden without motion.
function SheetBackdrop({ isOpen, closeSheet }: Omit<SheetProps, 'toTermInput'>) {
    return (
        <div
            className={cn(
                'absolute inset-0 z-20 bg-black/60',
                isOpen ? 'block' : 'hidden',
            )}
            data-state={isOpen ? 'open' : 'closed'}
            onClick={closeSheet}
        />
    )
}


type SheetCommandProps = {
    cmd: string;
    type: 'history' | 'saved';
    onClick: () => void;
    onFavAction: () => void;
}

function SheetCommand({ cmd, type, onClick, onFavAction }: SheetCommandProps) {
    return (
        <ListRow interactive className="gap-1 py-1 pr-1 sm:pr-1">
            <button
                type="button"
                onClick={onClick}
                className="min-h-9 min-w-0 flex-1 rounded-xs py-1 text-left font-mono text-dense text-body transition-colors duration-150 [overflow-wrap:anywhere] hover:text-white"
            >
                <span className="line-clamp-4">{cmd}</span>
            </button>
            {type === 'history' ? (
                <IconButton
                    label={t('Save command')}
                    icon={<StarIcon />}
                    tooltipSide="left"
                    onClick={onFavAction}
                />
            ) : (
                <IconButton
                    label={t('Remove saved command')}
                    icon={<StarOffIcon />}
                    tooltipSide="left"
                    onClick={onFavAction}
                />
            )}
        </ListRow>
    )
}


function SheetContent({ toTermInput }: Pick<SheetProps, 'toTermInput'>) {
    const { history, wipeHistory } = useLiveConsoleHistory();
    const { bookmarks, addBookmark, removeBookmark } = useLiveConsoleBookmarks();
    const openPromptDialog = useOpenPromptDialog();

    const handleWipeHistory = () => {
        txToast.success(t('Command history cleared.'));
        wipeHistory();
    }
    const handleSaveCommand = () => {
        openPromptDialog({
            title: t('Save command'),
            message: t('Enter the command to save:'),
            submitLabel: t('Save'),
            onSubmit: (cmd) => {
                if (cmd) addBookmark(cmd);
            }
        })
    }
    return (
        <div className="grid min-h-0 flex-1 grid-rows-2 gap-6 md:grid-cols-2 md:grid-rows-1">
            <section className="flex min-h-0 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-white">{t('Command history')}</h2>
                    <Button type="button" size="sm" variant="secondary" onClick={handleWipeHistory}>
                        {t('Clear history')}
                    </Button>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                    {history.length === 0 ? (
                        <EmptyState message={t('The command history is empty.')} />
                    ) : (
                        <ListRows className="pb-4">
                            {history.map((cmd, index) => (
                                <SheetCommand
                                    key={index}
                                    cmd={cmd}
                                    type='history'
                                    onClick={() => toTermInput(cmd)}
                                    onFavAction={() => addBookmark(cmd)}
                                />
                            ))}
                        </ListRows>
                    )}
                </ScrollArea>
            </section>
            <section className="flex min-h-0 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-white">{t('Saved commands')}</h2>
                    <Button type="button" size="sm" variant="secondary" onClick={handleSaveCommand}>
                        {t('Add command')}
                    </Button>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                    {bookmarks.length === 0 ? (
                        <EmptyState
                            message={`${t('There are no saved commands.')} ${t('Use the star beside a history entry to save it.')}`}
                        />
                    ) : (
                        <ListRows className="pb-4">
                            {bookmarks.map((cmd, index) => (
                                <SheetCommand
                                    key={index}
                                    cmd={cmd}
                                    type='saved'
                                    onClick={() => toTermInput(cmd)}
                                    onFavAction={() => removeBookmark(cmd)}
                                />
                            ))}
                        </ListRows>
                    )}
                </ScrollArea>
            </section>
        </div>
    )
}


export default function LiveConsoleSaveSheet({ isOpen, closeSheet, toTermInput }: SheetProps) {
    return <>
        <SheetBackdrop isOpen={isOpen} closeSheet={closeSheet} />
        <div
            data-state={isOpen ? 'open' : 'closed'}
            aria-hidden={!isOpen}
            className={cn(
                'absolute inset-y-0 right-0 z-20 w-full flex-col gap-4 bg-modal p-4 font-sans sm:p-6 md:max-w-2xl',
                isOpen ? 'flex' : 'hidden',
            )}
        >
            <div className="flex justify-end">
                <IconButton
                    label={t('Close')}
                    icon={<XIcon />}
                    className="size-11 sm:size-9"
                    onClick={closeSheet}
                />
            </div>
            <SheetContent toTermInput={toTermInput} />
        </div>
    </>;
}
