import TxAnchor from '@/components/TxAnchor';
import SwitchText from '@/components/SwitchText';
import { SettingItem, SettingItemDesc } from '../settingsItems';
import { useEffect, useMemo, useReducer } from "react";
import { getConfigEmptyState, getConfigAccessors, SettingsCardProps, getPageConfig, configsReducer, getConfigDiff } from "../utils";
import SettingsCardShell from '../SettingsCardShell';
import { t } from '@/lib/i18n';
import TransText from '@/components/TransText';


export const pageConfigs = {
    hideAdminInPunishments: getPageConfig('gameFeatures', 'hideAdminInPunishments'),
    hideAdminInMessages: getPageConfig('gameFeatures', 'hideAdminInMessages'),
    hideDefaultAnnouncement: getPageConfig('gameFeatures', 'hideDefaultAnnouncement'),
    hideDefaultDirectMessage: getPageConfig('gameFeatures', 'hideDefaultDirectMessage'),
    hideDefaultWarning: getPageConfig('gameFeatures', 'hideDefaultWarning'),
    hideScheduledRestartWarnings: getPageConfig('gameFeatures', 'hideDefaultScheduledRestartWarning'),
} as const;

export default function ConfigCardGameNotifications({ cardCtx, pageCtx }: SettingsCardProps) {
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

    //Processes the state of the page and sets the card as pending save if needed
    const updatePageState = () => {
        const overwrites = {};

        const res = getConfigDiff(cfg, states, overwrites, false);
        pageCtx.setCardPendingSave(res.hasChanges ? cardCtx : null);
        return res;
    }

    //Validate changes (for UX only) and trigger the save API
    const handleOnSave = () => {
        const { hasChanges, localConfigs } = updatePageState();
        if (!hasChanges) return;
        //NOTE: nothing to validate
        pageCtx.saveChanges(cardCtx, localConfigs);
    }

    return (
        <SettingsCardShell
            cardCtx={cardCtx}
            pageCtx={pageCtx}
            onClickSave={handleOnSave}
        >
            <SettingItem label={t('Hide Admin Name In Punishments')}>
                <SwitchText
                    id={cfg.hideAdminInPunishments.eid}
                    checkedLabel={t('Hidden')}
                    uncheckedLabel={t('Visible')}
                    checked={states.hideAdminInPunishments}
                    onCheckedChange={cfg.hideAdminInPunishments.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    <TransText k="Never show to the players the admin name on **Bans** or **Warns**." /> <br />
                    {t('This information will still be available in the history and logs.')}
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Hide Admin Name In Messages')}>
                <SwitchText
                    id={cfg.hideAdminInMessages.eid}
                    checkedLabel={t('Hidden')}
                    uncheckedLabel={t('Visible')}
                    checked={states.hideAdminInMessages}
                    onCheckedChange={cfg.hideAdminInMessages.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    <TransText k="Do not show the admin name on **Announcements** or **DMs**." /> <br />
                    {t('This information will still be available in the live console and logs.')}
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Hide Announcement Notifications')}>
                <SwitchText
                    id={cfg.hideDefaultAnnouncement.eid}
                    checkedLabel={t('Hidden')}
                    uncheckedLabel={t('Visible')}
                    checked={states.hideDefaultAnnouncement}
                    onCheckedChange={cfg.hideDefaultAnnouncement.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    <TransText
                        k="Suppresses the display of announcements, allowing you to implement your own announcement via the event `{event}`."
                        values={{ event: 'txAdmin:events:announcement' }}
                    />
                    &nbsp;<TxAnchor href="https://github.com/chyarofivem/cAdminPanel/blob/master/docs/events.md#txadmineventsannouncement">{t('Documentation')}</TxAnchor>
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Hide Direct Message Notification')}>
                <SwitchText
                    id={cfg.hideDefaultDirectMessage.eid}
                    checkedLabel={t('Hidden')}
                    uncheckedLabel={t('Visible')}
                    checked={states.hideDefaultDirectMessage}
                    onCheckedChange={cfg.hideDefaultDirectMessage.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    <TransText
                        k="Suppresses the display of direct messages, allowing you to implement your own direct message notification via the event `{event}`."
                        values={{ event: 'txAdmin:events:playerDirectMessage' }}
                    />
                    &nbsp;<TxAnchor href="https://github.com/chyarofivem/cAdminPanel/blob/master/docs/events.md#txadmineventsplayerdirectmessage">{t('Documentation')}</TxAnchor>
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Hide Warning Notification')}>
                <SwitchText
                    id={cfg.hideDefaultWarning.eid}
                    checkedLabel={t('Hidden')}
                    uncheckedLabel={t('Visible')}
                    checked={states.hideDefaultWarning}
                    onCheckedChange={cfg.hideDefaultWarning.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    <TransText
                        k="Suppresses the display of warnings, allowing you to implement your own warning via the event `{event}`."
                        values={{ event: 'txAdmin:events:playerWarned' }}
                    />
                    &nbsp;<TxAnchor href="https://github.com/chyarofivem/cAdminPanel/blob/master/docs/events.md#txadmineventsplayerwarned">{t('Documentation')}</TxAnchor>
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Hide Scheduled Restart Warnings')}>
                <SwitchText
                    id={cfg.hideScheduledRestartWarnings.eid}
                    checkedLabel={t('Hidden')}
                    uncheckedLabel={t('Visible')}
                    checked={states.hideScheduledRestartWarnings}
                    onCheckedChange={cfg.hideScheduledRestartWarnings.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    <TransText
                        k="Suppresses the display of scheduled restart warnings, allowing you to implement your own warning via the event `{event}`."
                        values={{ event: 'txAdmin:events:scheduledRestart' }}
                    />
                    &nbsp;<TxAnchor href="https://github.com/chyarofivem/cAdminPanel/blob/master/docs/events.md#txadmineventsscheduledrestart">{t('Documentation')}</TxAnchor>
                </SettingItemDesc>
            </SettingItem>
        </SettingsCardShell>
    )
}
