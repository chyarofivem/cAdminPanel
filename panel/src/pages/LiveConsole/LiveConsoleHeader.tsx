import { SettingsIcon } from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import type { LiveConsoleOptionsPopoverProps } from "./OptionsPopover";
import LiveConsoleOptionsPopover from "./OptionsPopover";
import { useState } from "react";
import { useContentRefresh } from "@/hooks/pages";
import { t } from '@/lib/i18n';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';


type LiveConsoleHeaderProps = Omit<LiveConsoleOptionsPopoverProps, 'setHasPendingRefresh'> & {
    isConnected: boolean;
};

export default function LiveConsoleHeader(popoverProps: LiveConsoleHeaderProps) {
    const [hasPendingRefresh, setHasPendingRefresh] = useState(false);
    const refreshPage = useContentRefresh();

    return (
        <PageHeader title={t('Console Log')}>
            <Badge variant={popoverProps.isConnected ? 'success' : 'warning'} aria-live="polite">
                {popoverProps.isConnected ? t('Live') : t('Reconnecting')}
            </Badge>
            <Badge>{t('3-start rotation')}</Badge>
            <Popover onOpenChange={(state) => {
                if (!state && hasPendingRefresh) {
                    refreshPage();
                    setHasPendingRefresh(false);
                }
            }}>
                <PopoverTrigger asChild>
                    <IconButton
                        label={t('Console display settings')}
                        icon={<SettingsIcon />}
                        className="size-11 sm:size-9"
                    />
                </PopoverTrigger>
                <LiveConsoleOptionsPopover
                    options={popoverProps.options}
                    setOptions={popoverProps.setOptions}
                    setHasPendingRefresh={setHasPendingRefresh}
                />
            </Popover>
        </PageHeader>
    )
}
