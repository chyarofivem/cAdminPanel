import useWarningBar from "@/hooks/useWarningBar";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import TxAnchor from "@/components/TxAnchor";
import { CloudOffIcon, DownloadCloudIcon } from "lucide-react";
import type { UpdateAvailableEventType } from "@shared/socketioTypes";

type InnerWarningBarProps = {
    titleIcon: React.ReactNode;
    title: React.ReactNode;
    description: React.ReactNode;
    isImportant: boolean;
};

export function InnerWarningBar({ titleIcon, title, description, isImportant }: InnerWarningBarProps) {
    return (
        <div className='fixed top-navbarvh w-full flex justify-center z-40'>
            <div className={cn(
                "w-full sm:w-[28rem] min-h-9 hover:min-h-32 overflow-hidden sm:rounded-b-md",
                "flex flex-col justify-center items-center p-1",
                "group cursor-default transition-[height] shadow-xl",
                isImportant ? 'bg-destructive text-destructive-foreground' : 'bg-info text-info-foreground'
            )}>
                <h2 className="text-md text-center group-hover:font-medium">
                    {titleIcon}
                    {title}
                </h2>

                <span className='hidden group-hover:block text-center text-sm'>
                    {description}
                </span>
            </div>
        </div>
    );
}


//The anchor sits on a solid accent background, so the default link colour is dropped
const linkClasses = "text-inherit underline font-semibold";

function UpdateWarningBar({ panel, fxserver }: UpdateAvailableEventType) {
    return (
        <InnerWarningBar
            titleIcon={<DownloadCloudIcon className="inline h-[1.2rem] -mt-1 mr-1" />}
            title={panel
                ? t('cAdminPanel v{version} is available.', { version: panel.version })
                : t('FXServer build {version} is available.', { version: fxserver!.version })}
            description={<>
                {panel && (
                    <span className="block">
                        {t('You are running v{version}.', { version: window.txConsts.txaVersion })}
                        {panel.url && <> <TxAnchor href={panel.url} className={linkClasses}>
                            {t('View release')}
                        </TxAnchor></>}
                    </span>
                )}
                {fxserver && (
                    <span className="block">
                        {t('FXServer build {version} is recommended, you are running build {current}.', {
                            version: fxserver.version,
                            current: window.txConsts.fxsVersion,
                        })}
                        {fxserver.url && <> <TxAnchor href={fxserver.url} className={linkClasses}>
                            {t('View artifacts')}
                        </TxAnchor></>}
                    </span>
                )}
            </>}
            isImportant={!!panel?.isImportant || !!fxserver?.isImportant}
        />
    );
}


export default function WarningBar() {
    const { offlineWarning, updateAvailable } = useWarningBar();

    if (offlineWarning) {
        return <InnerWarningBar
            titleIcon={<CloudOffIcon className="inline h-[1.2rem] -mt-1 mr-1" />}
            title={t('Socket connection lost.')}
            description={<>
                {t('The connection to the cAdminPanel server has been lost.')} <br />
                {t('If you closed FXServer, please restart it.')}
            </>}
            isImportant={true}
        />
    } else if (updateAvailable && (updateAvailable.panel || updateAvailable.fxserver)) {
        return <UpdateWarningBar {...updateAvailable} />
    } else {
        return null;
    }
}
