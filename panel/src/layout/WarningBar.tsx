import useWarningBar from "@/hooks/useWarningBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { t } from "@/lib/i18n";
import TxAnchor from "@/components/TxAnchor";
import type { UpdateAvailableEventType } from "@shared/socketioTypes";

type InnerWarningBarProps = {
    title: React.ReactNode;
    description: React.ReactNode;
    isImportant: boolean;
};

/**
 * A system banner (connection lost, update available) at the top of the page content.
 * It is a callout: one flat status tint with its status icon, and it does not float.
 */
export function InnerWarningBar({ title, description, isImportant }: InnerWarningBarProps) {
    return (
        <Alert variant={isImportant ? 'destructive' : 'info'} className="mt-4">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
        </Alert>
    );
}


const linkClasses = "text-sm";

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
