import React, { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthedFileDownload } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import { BookMarkedIcon, FileDownIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useAdminPerms } from '@/hooks/auth';
import { useLiveConsoleHistory } from '@/pages/LiveConsole/liveConsoleHooks';
import { useAtomValue } from 'jotai';
import { fxRunnerStateAtom } from '@/hooks/status';
import { t } from '@/lib/i18n';


type ConsoleFooterButtonProps = {
    icon: React.ElementType;
    title: string;
    disabled?: boolean;
    onClick: () => void;
}

function ConsoleFooterButton({ icon: Icon, title, disabled, onClick }: ConsoleFooterButtonProps) {
    return (
        <button
            type="button"
            aria-label={title}
            title={title}
            disabled={disabled}
            className={cn(
                'group grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:pointer-events-none disabled:opacity-40',
            )}
            onClick={onClick}
        >
            <Icon className="size-4 transition-transform group-hover:scale-110" />
        </button>
    )
}


type LiveConsoleFooterProps = {
    isConnected: boolean;
    consoleWrite: (_data: string) => void;
    consoleClear: () => void;
    toggleSaveSheet: () => void;
    toggleSearchBar: () => void;
    termInputRef: React.RefObject<HTMLInputElement>;
}

export default function LiveConsoleFooter(props: LiveConsoleFooterProps) {
    const { history, appendHistory } = useLiveConsoleHistory();
    const [histIndex, setHistIndex] = useState(-1);
    const savedInput = useRef('');
    const termInputRef = props.termInputRef;
    const { hasPerm } = useAdminPerms();
    const hasWritePerm = hasPerm('console.write');
    const fxRunnerState = useAtomValue(fxRunnerStateAtom);
    const downloadFile = useAuthedFileDownload();
    const [isDownloading, setIsDownloading] = useState(false);

    const downloadLog = async () => {
        setIsDownloading(true);
        try {
            await downloadFile('/fxserver/downloadLog');
        } catch (error) {
            txToast.error(error instanceof Error ? error.message : t('The download failed.'));
        } finally {
            setIsDownloading(false);
        }
    };

    //autofocus on input when connected
    useEffect(() => {
        if (props.isConnected && termInputRef.current) {
            termInputRef.current.focus();
        }
    }, [props.isConnected, termInputRef]);

    const handleArrowUp = () => {
        if (!termInputRef.current) return;
        if (histIndex === -1) {
            savedInput.current = termInputRef.current.value ?? '';
        }
        const nextHistId = histIndex + 1;
        if (history[nextHistId]) {
            termInputRef.current.value = history[nextHistId];
            setHistIndex(nextHistId);
        }
    };

    const handleArrowDown = () => {
        if (!termInputRef.current) return;
        const prevHistId = histIndex - 1;
        if (prevHistId === -1) {
            termInputRef.current.value = savedInput.current;
            setHistIndex(prevHistId);
        } else if (history[prevHistId]) {
            termInputRef.current.value = history[prevHistId];
            setHistIndex(prevHistId);
        }
    };

    const handleEnter = () => {
        if (!termInputRef.current) return;
        const currentInput = termInputRef.current.value.trim();
        setHistIndex(-1);
        termInputRef.current.value = '';
        savedInput.current = '';
        if (currentInput) {
            appendHistory(currentInput);
            props.consoleWrite(currentInput);
        } else {
            props.consoleWrite('\n');
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!props.isConnected) return;
        if (e.key === 'ArrowUp') {
            handleArrowUp();
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            handleArrowDown();
            e.preventDefault();
        } else if (e.key === 'Enter') {
            handleEnter();
            e.preventDefault();
        }
    }

    let inputError: string | undefined;
    if (!hasWritePerm) {
        inputError = t('You do not have permission to write to the console.');
    } else if (!fxRunnerState.isChildAlive) {
        inputError = t('The server is not running.');
    } else if (!props.isConnected) {
        inputError = t('Socket connection lost.');
    }

    return (
        <footer className="flex flex-col gap-3 border-t border-white/10 bg-black/20 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
            <div className="flex min-w-0 grow items-center rounded-xl border border-white/10 bg-black/25 px-3 focus-within:border-brand-500/40 focus-within:ring-1 focus-within:ring-brand-500/20">
                <span className="mr-2 select-none font-mono text-sm text-brand-400">$</span>
                <Input
                    ref={termInputRef}
                    className={cn(
                        'h-10 w-full border-0 bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
                        !!inputError && 'placeholder:text-destructive placeholder:opacity-100'
                    )}
                    placeholder={inputError ?? t('Type a command...')}
                    type="text"
                    disabled={!!inputError}
                    onKeyDown={handleInputKeyDown}
                    autoCapitalize='none'
                    autoComplete='off'
                    autoCorrect='off'
                />
            </div>
            <div className="flex flex-row justify-end gap-2 select-none">
                <ConsoleFooterButton
                    icon={BookMarkedIcon}
                    title={t('Saved commands')}
                    onClick={props.toggleSaveSheet}
                />
                <ConsoleFooterButton
                    icon={SearchIcon}
                    title={t('Search console')}
                    disabled={!props.isConnected}
                    onClick={props.toggleSearchBar}
                />
                <ConsoleFooterButton
                    icon={Trash2Icon}
                    title={t('Clear console')}
                    disabled={!props.isConnected}
                    onClick={props.consoleClear}
                />
                <ConsoleFooterButton
                    icon={FileDownIcon}
                    title={t('Download console log')}
                    disabled={!props.isConnected || isDownloading}
                    onClick={downloadLog} />
            </div>
        </footer>
    );
}
