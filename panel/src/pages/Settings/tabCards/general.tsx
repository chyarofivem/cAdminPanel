import { Input } from "@/components/ui/input"
import { SettingItem, SettingItemDesc } from '../settingsItems'
import { useEffect, useRef, useMemo, useReducer } from "react"
import { getConfigEmptyState, getConfigAccessors, SettingsCardProps, getPageConfig, configsReducer, getConfigDiff } from "../utils"
import SettingsCardShell from "../SettingsCardShell"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { txToast } from "@/components/TxToaster"
import { t } from "@/lib/i18n"
import { RestartScheduleBox, TimeZoneWarning } from './fxserver'


export const pageConfigs = {
    serverName: getPageConfig('general', 'serverName'),
    language: getPageConfig('general', 'language'),
    restarterSchedule: getPageConfig('restarter', 'schedule'),
} as const;

export default function ConfigCardGeneral({ cardCtx, pageCtx }: SettingsCardProps) {
    const [states, dispatch] = useReducer(
        configsReducer<typeof pageConfigs>,
        null,
        () => getConfigEmptyState(pageConfigs),
    );
    const cfg = useMemo(() => {
        return getConfigAccessors(cardCtx.cardId, pageConfigs, pageCtx.apiData, dispatch);
    }, [pageCtx.apiData, dispatch]);

    //Effects - handle changes and reset advanced settings
    useEffect(() => {
        updatePageState();
    }, [states]);

    //Refs for configs that don't use state
    const serverNameRef = useRef<HTMLInputElement | null>(null);

    //Processes the state of the page and sets the card as pending save if needed
    const updatePageState = () => {
        const overwrites = {
            serverName: serverNameRef.current?.value,
        };

        const res = getConfigDiff(cfg, states, overwrites, false);
        pageCtx.setCardPendingSave(res.hasChanges ? cardCtx : null);
        return res;
    }

    //Validate changes (for UX only) and trigger the save API
    const handleOnSave = () => {
        const { hasChanges, localConfigs } = updatePageState();
        if (!hasChanges) return;

        if (!localConfigs.general?.serverName) {
            return txToast.error(t('The Server Name is required.'));
        }
        if (localConfigs.general?.serverName?.length > 18) {
            return txToast.error(t('The Server Name is too big.'));
        }
        pageCtx.saveChanges(cardCtx, localConfigs);
    }

    const localeData = useMemo(() => {
        if (!pageCtx.apiData?.locales) return null;
        return pageCtx.apiData.locales.map(locale => ({
            ...locale,
            label: locale.code === 'en' ? t('English (default)') : locale.label,
        }));
    }, [pageCtx.apiData]);

    return (
        <SettingsCardShell
            cardCtx={cardCtx}
            pageCtx={pageCtx}
            onClickSave={handleOnSave}
        >
            <SettingItem label={t('Server Name')} htmlFor={cfg.serverName.eid} required>
                <Input
                    id={cfg.serverName.eid}
                    ref={serverNameRef}
                    defaultValue={cfg.serverName.initialValue}
                    placeholder={'Example RP'}
                    onInput={updatePageState}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    {t('A short server name used in the panel and Server/Discord messages. The name must contain 1–18 characters.')}
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Language')} htmlFor={cfg.language.eid} required>
                <Select
                    value={states.language}
                    onValueChange={cfg.language.state.set as any}
                    disabled={pageCtx.isReadOnly}
                >
                    <SelectTrigger id={cfg.language.eid}>
                        <SelectValue placeholder={t('Select...')} />
                    </SelectTrigger>
                    <SelectContent>
                        {localeData?.map(locale => <SelectItem key={locale.code} value={locale.code}>{locale.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <SettingItemDesc>
                    {t('The language used by the panel, in-game menu, chat, and Discord messages.')}
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Restart Schedule')} showOptional>
                <RestartScheduleBox restartTimes={states.restarterSchedule} setRestartTimes={cfg.restarterSchedule.state.set} disabled={pageCtx.isReadOnly} />
                <TimeZoneWarning />
                <SettingItemDesc>{t('Times use the server timezone. Scheduled restarts remain available without exposing FXServer configuration.')}</SettingItemDesc>
            </SettingItem>
        </SettingsCardShell>
    )
}
