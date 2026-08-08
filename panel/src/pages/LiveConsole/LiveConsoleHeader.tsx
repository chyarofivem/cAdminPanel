import { CircleIcon, SettingsIcon, TerminalSquareIcon } from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import type { LiveConsoleOptionsPopoverProps } from "./OptionsPopover";
import LiveConsoleOptionsPopover from "./OptionsPopover";
import { useState } from "react";
import { useContentRefresh } from "@/hooks/pages";
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';


type LiveConsoleHeaderProps = Omit<LiveConsoleOptionsPopoverProps, 'setHasPendingRefresh'> & {
    isConnected: boolean;
};

export default function LiveConsoleHeader(popoverProps: LiveConsoleHeaderProps) {
    const [hasPendingRefresh, setHasPendingRefresh] = useState(false);
    const refreshPage = useContentRefresh();

    return (
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-brand-950/35 via-zinc-950/80 to-zinc-950 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand-500/20 bg-brand-500/10 text-brand-400">
                    <TerminalSquareIcon className="size-5" />
                </span>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-lg font-semibold text-white">{t('Console Log')}</h1>
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
                    </div>
                    <p className="mt-0.5 truncate text-sm text-zinc-500">
                        {t('Interactive FXServer output and command console.')}
                    </p>
                </div>
            </div>

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
        </header>
    )
}
