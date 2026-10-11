import { PopoverContent } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollbackSizes } from "./xtermOptions";
import type { TerminalOptions, ScrollbackSize, DensityMode, TimestampMode } from "./xtermOptions";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { t } from '@/lib/i18n';

export type LiveConsoleOptionsPopoverProps = {
    options: TerminalOptions;
    setOptions: (options: Partial<TerminalOptions>) => void;
    setHasPendingRefresh: (hasPendingRefresh: boolean) => void;
}

export default function LiveConsoleOptionsPopover({
    options,
    setOptions,
    setHasPendingRefresh,
}: LiveConsoleOptionsPopoverProps) {
    return (
        <PopoverContent className="w-[min(24rem,calc(100vw-2rem))]" align="end">
            <div className="grid gap-6">
                {/* Header */}
                <div className="space-y-1">
                    <h4 className="text-base font-semibold leading-tight text-white">{t('Console display settings')}</h4>
                    <p className="text-sm text-muted-foreground">
                        {t('Customize the console appearance and behavior. These settings are saved in this browser.')}
                    </p>
                </div>

                {/* Display Settings */}
                <div className="space-y-4">
                    <h5 className="text-sm font-medium leading-tight text-white">{t('Display options')}</h5>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="density">{t('Font size')}</Label>
                            <div>
                                <Select
                                    value={options.density}
                                    onValueChange={(value) => setOptions({ density: value as DensityMode })}
                                >
                                    <SelectTrigger id="density">
                                        <SelectValue placeholder={t('Select density')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SPACIOUS">{t('Large')}</SelectItem>
                                        <SelectItem value="COMFORTABLE">{t('Medium')}</SelectItem>
                                        <SelectItem value="COMPACT">{t('Small')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="timestamp">{t('Timestamp')}</Label>
                                <div>
                                    <Select
                                        value={options.timestamp}
                                        onValueChange={(value) => {
                                            setHasPendingRefresh(true);
                                            setOptions({ timestamp: value as TimestampMode });
                                        }}
                                    >
                                        <SelectTrigger id="timestamp">
                                            <SelectValue placeholder={t('Select timestamp mode')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DEFAULT">{t('System default')}</SelectItem>
                                            <SelectItem value="FORCE12H">{t('Force 12-hour mode')}</SelectItem>
                                            <SelectItem value="FORCE24H">{t('Force 24-hour mode')}</SelectItem>
                                            <SelectItem value="DISABLED">{t('Disabled')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="scrollback">{t('Scrollback')}</Label>
                            <div>
                                <Select
                                    value={options.scrollback.toString()}
                                    onValueChange={(value) => setOptions({ scrollback: Number(value) as ScrollbackSize })}
                                >
                                    <SelectTrigger id="scrollback">
                                        <SelectValue placeholder={t('Select size')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ScrollbackSizes.LARGE.toString()}>{t('10k lines')}</SelectItem>
                                        <SelectItem value={ScrollbackSizes.MEDIUM.toString()}>{t('5k lines (default)')}</SelectItem>
                                        <SelectItem value={ScrollbackSizes.SMALL.toString()}>{t('2.5k lines')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator className="my-1" />

                {/* Copy Settings */}
                <div className="space-y-4">
                    <h5 className="text-sm font-medium leading-tight text-white">{t('Copy options')}</h5>
                    <div className="grid gap-4">
                        <div className="flex min-h-11 items-center justify-between gap-4">
                            <Label htmlFor="copyTimestamp">{t('Include timestamp')}</Label>
                            <Switch
                                id="copyTimestamp"
                                checked={options.copyTimestamp}
                                onCheckedChange={(checked) => setOptions({ copyTimestamp: checked })}
                            />
                        </div>
                        <div className="flex min-h-11 items-center justify-between gap-4">
                            <Label htmlFor="copyChannel">{t('Include channel')}</Label>
                            <Switch
                                id="copyChannel"
                                checked={options.copyChannel}
                                onCheckedChange={(checked) => setOptions({ copyChannel: checked })}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </PopoverContent>
    )
}
