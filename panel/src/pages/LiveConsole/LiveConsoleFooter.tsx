import React, { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthedFileDownload } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import { BookMarkedIcon, DownloadIcon, EraserIcon, SearchIcon } from "lucide-react";
import { useAdminPerms } from '@/hooks/auth';
import { useLiveConsoleHistory } from '@/pages/LiveConsole/liveConsoleHooks';
import { useAtomValue } from 'jotai';
import { fxRunnerStateAtom } from '@/hooks/status';
import { t } from '@/lib/i18n';
import { IconButton } from '@/components/ui/icon-button';


type ConsoleFooterButtonProps = {
    icon: React.ReactNode;
    title: string;
    disabled?: boolean;
    onClick: () => void;
}

//Toolbar actions: 44px targets on phones, 36px from the sm breakpoint.
function ConsoleFooterButton({ icon, title, disabled, onClick }: ConsoleFooterButtonProps) {
    return (
        <IconButton
            label={title}
            icon={icon}
            disabled={disabled}
            onClick={onClick}
            className="size-11 sm:size-9"
        />
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
        <footer className="flex flex-col gap-2 border-t border-hairline p-2 sm:flex-row sm:items-center sm:px-3">
            <div className="flex min-w-0 grow items-center rounded-sm px-3 ring-1 ring-inset ring-hairline transition-shadow duration-150 focus-within:ring-2 focus-within:ring-accent-text">
                <span className="mr-2 select-none font-mono text-sm text-muted-foreground" aria-hidden="true">$</span>
                <Input
                    ref={termInputRef}
                    aria-label={t('Type a command...')}
                    className={cn(
                        'w-full bg-transparent px-0 font-mono ring-0 focus-visible:ring-0',
                        !!inputError && 'placeholder:text-danger-text placeholder:opacity-100'
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
            <div className="flex flex-row flex-wrap justify-end gap-1 select-none">
                <ConsoleFooterButton
                    icon={<BookMarkedIcon />}
                    title={t('Saved commands')}
                    onClick={props.toggleSaveSheet}
                />
                <ConsoleFooterButton
                    icon={<SearchIcon />}
                    title={t('Search console')}
                    disabled={!props.isConnected}
                    onClick={props.toggleSearchBar}
                />
                <ConsoleFooterButton
                    icon={<EraserIcon />}
                    title={t('Clear console')}
                    disabled={!props.isConnected}
                    onClick={props.consoleClear}
                />
                <ConsoleFooterButton
                    icon={<DownloadIcon />}
                    title={t('Download console log')}
                    disabled={!props.isConnected || isDownloading}
                    onClick={downloadLog} />
            </div>
        </footer>
    );
}
