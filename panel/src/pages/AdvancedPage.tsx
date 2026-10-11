
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DownloadIcon, EraserIcon, HelpCircleIcon } from "lucide-react";
import { advancedCommands } from "@shared/advancedCommands";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import JsonCodeBlock from "@/components/JsonCodeBlock";
import MarkdownProse from "@/components/MarkdownProse";
import { downloadTextFile } from "@/lib/utils";
import { txToast } from "@/components/TxToaster";
import type {
    RunAdvancedCommandResp,
    RunAdvancedCommandReq,
} from "@shared/advancedCommands";
import { getUrlSearchParam, setUrlSearchParam } from "@/lib/navigation";
import { useBackendApi } from "@/hooks/fetch";
import { t } from "@/lib/i18n";
import { isSensitiveAdvancedCommand } from "./advancedUtils";


function HelpPopover({ onCommandClick }: { onCommandClick: (c: string) => void }) {
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const handleCommandClick = (commandName: string) => {
        onCommandClick(commandName);
        setIsHelpOpen(false);
    }

    return (
        <Popover open={isHelpOpen} onOpenChange={setIsHelpOpen}>
            <PopoverTrigger asChild>
                <IconButton
                    label={t('Available commands')}
                    icon={<HelpCircleIcon />}
                    className="size-11 sm:size-9"
                />
            </PopoverTrigger>
            <PopoverContent className="w-[min(32rem,calc(100vw-2rem))] p-0" align="end">
                <div className="border-b border-hairline p-4">
                    <h3 className="text-base font-semibold text-white">{t('Available commands')}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t('Select a command to fill it in.')}</p>
                </div>
                <ScrollArea className="h-[min(500px,60vh)]">
                    <div className="flex flex-col gap-2 p-2">
                        {advancedCommands.map((cmd) => (
                            <button
                                type="button"
                                key={cmd.name}
                                className="flex w-full flex-col gap-2 rounded-sm p-3 text-left transition-colors duration-150 hover:bg-raise"
                                onClick={() => handleCommandClick(cmd.name)}
                            >
                                <span className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm font-semibold text-white">
                                        {cmd.name}
                                    </span>
                                    {cmd.args?.map((arg, index) => (
                                        <Badge key={index} className="font-mono font-normal">
                                            {arg}
                                        </Badge>
                                    ))}
                                </span>
                                <span className="text-dense text-muted-foreground">
                                    {cmd.desc}
                                </span>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}


function OutputArea({ output }: { output: RunAdvancedCommandResp | null }) {
    if (!output) {
        return <p className="text-sm text-muted-foreground">
            {t('No output yet. Run a command to see its output here.')}
        </p>;
    }
    if ('error' in output) {
        return <Alert variant="destructive">
            <AlertTitle>{t('Error')}</AlertTitle>
            <AlertDescription>{output.error}</AlertDescription>
        </Alert>;
    }
    return <div className="overflow-x-auto rounded-lg bg-sunken p-4">
        {output.type === 'md'
            ? <MarkdownProse md={output.data} className="max-w-none" />
            : <JsonCodeBlock value={output.data} />}
    </div>;
}

export default function AdvancedPage() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [output, setOutput] = useState<RunAdvancedCommandResp | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const runCommandApi = useBackendApi<RunAdvancedCommandResp, RunAdvancedCommandReq>({
        method: 'POST',
        path: `/advanced/run`,
    });

    //Get autofill from the url
    useEffect(() => {
        if (!inputRef.current) return;
        const autofill = getUrlSearchParam('cmd');
        if (autofill) {
            if (isSensitiveAdvancedCommand(autofill)) {
                setUrlSearchParam('cmd', undefined);
                return;
            }
            inputRef.current.value = autofill;
            inputRef.current.focus();
        }
    }, [inputRef]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || !inputRef.current) return;
        const cmd = inputRef.current.value.trim();
        if (!cmd) {
            inputRef.current.focus();
            return;
        }

        setUrlSearchParam('cmd', isSensitiveAdvancedCommand(cmd) ? undefined : cmd);
        setIsLoading(true);
        runCommandApi({
            data: { cmd },
            finally: () => {
                setIsLoading(false);
                setTimeout(() => inputRef.current?.focus(), 50);
            },
            success: (data) => setOutput(data),
            error: (error) => setOutput({ error }),
        });
    }

    const handleClearOutput = () => {
        setOutput(null);
    }

    const handleSave = () => {
        if (!output) return;
        const content = 'error' in output ? output.error : output.data;
        const command = inputRef.current?.value.trim() || 'command';
        const extension = 'error' in output ? 'txt' : output.type === 'md' ? 'md' : 'json';
        const success = downloadTextFile(content, command, extension);
        if (!success) {
            txToast.error(t('Failed to download file. Please try again.'));
        }
    }

    return (
        <div className="flex w-full flex-col pb-8">
            <PageHeader title={t('Advanced')}>
                <HelpPopover onCommandClick={(c) => {
                    if (!inputRef.current) return;
                    inputRef.current.value = c + " ";
                    inputRef.current.focus();
                }} />
            </PageHeader>

            <div className="flex flex-col gap-6">
                <Alert variant="warning">
                    <AlertTitle>{t('Caution')}</AlertTitle>
                    <AlertDescription>
                        {t('This page is for advanced users only and has no documentation.')}{' '}
                        <strong className="font-semibold text-white">{t('Use at your own risk.')}</strong>
                    </AlertDescription>
                </Alert>

                <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-3">
                    <Input
                        ref={inputRef}
                        className="font-mono"
                        disabled={isLoading}
                        aria-label={t('Command')}
                        placeholder={t('Type a command or open the command list')}
                        autoCapitalize="none"
                        autoComplete="off"
                        autoCorrect="off"
                    />
                    <div>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? t('Running…') : t('Run command')}
                        </Button>
                    </div>
                </form>

                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-base font-semibold text-white">{t('Output')}</h2>
                        <div className="flex gap-1">
                            <IconButton
                                label={t('Clear output')}
                                icon={<EraserIcon />}
                                className="size-11 sm:size-9"
                                onClick={handleClearOutput}
                                disabled={!output}
                            />
                            <IconButton
                                label={t('Download output')}
                                icon={<DownloadIcon />}
                                className="size-11 sm:size-9"
                                onClick={handleSave}
                                disabled={!output}
                            />
                        </div>
                    </div>
                    <OutputArea output={output} />
                </section>
            </div>
        </div>
    )
}
