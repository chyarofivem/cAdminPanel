import { CircleIcon, SettingsIcon, TerminalSquareIcon } from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import type { LiveConsoleOptionsPopoverProps } from "./OptionsPopover";
import LiveConsoleOptionsPopover from "./OptionsPopover";
import { useState } from "react";
import { useContentRefresh } from "@/hooks/pages";
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';


type LiveConsoleHeaderProps = Omit<LiveConsoleOptionsPopoverProps, 'setHasPendingRefresh'> & {
    isConnected: boolean;
};

export default function LiveConsoleHeader(popoverProps: LiveConsoleHeaderProps) {
    const [hasPendingRefresh, setHasPendingRefresh] = useState(false);
    const refreshPage = useContentRefresh();

    return (
        <PageHeader title={t('Console Log')} icon={<TerminalSquareIcon className="size-6" />}>
            <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]',
                    popoverProps.isConnected
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : 'border-amber-500/20 bg-amber-500/10 text-amber-300',
                )}>
                    <CircleIcon className={cn('size-1.5 fill-current', popoverProps.isConnected && 'animate-pulse')} />
                    {popoverProps.isConnected ? t('Live') : t('Reconnecting')}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    {t('3-start rotation')}
                </span>
                <Popover onOpenChange={(state) => {
                    if (!state && hasPendingRefresh) {
                        refreshPage();
                        setHasPendingRefresh(false);
                    }
                }}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label={t('Console display settings')}
                            title={t('Console display settings')}
                        >
                            <SettingsIcon className="size-4" />
                        </button>
                    </PopoverTrigger>
                    <LiveConsoleOptionsPopover
                        options={popoverProps.options}
                        setOptions={popoverProps.setOptions}
                        setHasPendingRefresh={setHasPendingRefresh}
                    />
                </Popover>
            </div>
        </PageHeader>
    )
}
