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
        <PopoverContent className="w-96">
            <div className="grid gap-6">
                {/* Header */}
                <div className="space-y-1.5">
                    <h4 className="font-medium leading-none">{t('Console display settings')}</h4>
                    <p className="text-sm text-muted-foreground">
                        {t('Customize the console appearance and behavior. These settings are saved in this browser.')}
                    </p>
                </div>

                {/* Display Settings */}
                <div className="space-y-4">
                    <h5 className="text-sm font-medium leading-none">{t('Display options')}</h5>
                    <div className="grid gap-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="density" className="col-span-1">{t('Font size')}</Label>
                            <div className="col-span-3">
                                <Select
                                    value={options.density}
                                    onValueChange={(value) => setOptions({ density: value as DensityMode })}
                                >
                                    <SelectTrigger>
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
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="timestamp" className="col-span-1">{t('Timestamp')}</Label>
                                <div className="col-span-3">
                                    <Select
                                        value={options.timestamp}
                                        onValueChange={(value) => {
                                            setHasPendingRefresh(true);
                                            setOptions({ timestamp: value as TimestampMode });
                                        }}
                                    >
                                        <SelectTrigger>
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

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="scrollback" className="col-span-1">{t('Scrollback')}</Label>
                            <div className="col-span-3">
                                <Select
                                    value={options.scrollback.toString()}
                                    onValueChange={(value) => setOptions({ scrollback: Number(value) as ScrollbackSize })}
                                >
                                    <SelectTrigger>
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
                    <h5 className="text-sm font-medium leading-none">{t('Copy options')}</h5>
                    <div className="grid gap-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="copyTimestamp">{t('Include timestamp')}</Label>
                            <Switch
                                id="copyTimestamp"
                                checked={options.copyTimestamp}
                                onCheckedChange={(checked) => setOptions({ copyTimestamp: checked })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
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
