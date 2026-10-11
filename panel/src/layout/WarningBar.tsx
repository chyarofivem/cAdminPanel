import useWarningBar from "@/hooks/useWarningBar";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import TxAnchor from "@/components/TxAnchor";
import type { UpdateAvailableEventType } from "@shared/socketioTypes";

type InnerWarningBarProps = {
    title: React.ReactNode;
    description: React.ReactNode;
    isImportant: boolean;
};

/**
 * A floating notice at the top of the viewport. It is a menu surface with a 4px
 * status bar, so the words carry the status and the colour only reinforces it.
 */
export function InnerWarningBar({ title, description, isImportant }: InnerWarningBarProps) {
    return (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4">
            <div
                role={isImportant ? 'alert' : 'status'}
                className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-xs bg-menu py-3 pl-5 pr-4 shadow-menu"
            >
                <div aria-hidden className={cn('absolute inset-y-0 left-0 w-1', isImportant ? 'bg-danger' : 'bg-info')} />
                <h2 className="text-sm font-medium text-white">{title}</h2>
                <div className="mt-0.5 text-dense text-muted-foreground">{description}</div>
            </div>
        </div>
    );
}


const linkClasses = "text-dense";

function UpdateWarningBar({ panel, fxserver }: UpdateAvailableEventType) {
    return (
        <InnerWarningBar
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
            title={t('Socket connection lost.')}
            description={<>
                {t('The connection to the cAdminPanel server has been lost.')}{' '}
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
