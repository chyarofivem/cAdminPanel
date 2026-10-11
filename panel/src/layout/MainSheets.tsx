import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ServerSidebar } from "./ServerSidebar/ServerSidebar";
import { useServerSheet } from "@/hooks/sheets";
import { t } from '@/lib/i18n';


/**
 * Below 1024px the sidebar becomes this slide-in drawer.
 */
export function ServerSidebarSheet() {
    const { isSheetOpen, setIsSheetOpen } = useServerSheet();
    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent
                side='left'
                aria-describedby={undefined}
                className="w-full max-w-[20rem] overflow-y-auto bg-sidebar p-0 sm:p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <SheetTitle className="sr-only">{t('Navigation')}</SheetTitle>
                <ServerSidebar isSheet />
            </SheetContent>
        </Sheet>
    );
}

export default function MainSheets() {
    return <>
        <ServerSidebarSheet />
    </>;
}
