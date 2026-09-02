import { Input } from "@/components/ui/input"
import SwitchText from '@/components/SwitchText'
import { SettingItem, SettingItemDesc } from '../settingsItems'
import { useEffect, useRef, useMemo, useReducer } from "react"
import { getConfigEmptyState, getConfigAccessors, SettingsCardProps, getPageConfig, configsReducer, getConfigDiff } from "../utils"
import SettingsCardShell from "../SettingsCardShell"
import { txToast } from "@/components/TxToaster"
import { t } from "@/lib/i18n"
import TransText from "@/components/TransText"
import { useAdminPerms } from "@/hooks/auth"


export const pageConfigs = {
    botEnabled: getPageConfig('discordBot', 'enabled'),
    botToken: getPageConfig('discordBot', 'token'),
    discordGuild: getPageConfig('discordBot', 'guild'),
    warningsChannel: getPageConfig('discordBot', 'warningsChannel'),
} as const;

export default function ConfigCardDiscord({ cardCtx, pageCtx }: SettingsCardProps) {
    const { isMaster } = useAdminPerms();
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
    const botTokenRef = useRef<HTMLInputElement | null>(null);
    const discordGuildRef = useRef<HTMLInputElement | null>(null);
    const warningsChannelRef = useRef<HTMLInputElement | null>(null);

    //Marshalling Utils
    const emptyToNull = (str?: string) => {
        if (str === undefined) return undefined;
        const trimmed = str.trim();
        return trimmed.length ? trimmed : null;
    };

    //Processes the state of the page and sets the card as pending save if needed
    const updatePageState = () => {
        const overwrites = {
            botToken: emptyToNull(botTokenRef.current?.value),
            discordGuild: emptyToNull(discordGuildRef.current?.value),
            warningsChannel: emptyToNull(warningsChannelRef.current?.value),
        };

        const editableConfigs = isMaster
            ? cfg
            : Object.fromEntries(Object.entries(cfg).filter(([name]) => name !== 'botToken'));
        const res = getConfigDiff(editableConfigs, states, overwrites, false);
        pageCtx.setCardPendingSave(res.hasChanges ? cardCtx : null);
        return res;
    }

    //Validate changes (for UX only) and trigger the save API
    const handleOnSave = () => {
        const { hasChanges, localConfigs } = updatePageState();
        if (!hasChanges) return;

        if (localConfigs.discordBot?.enabled) {
            const hasBotToken = isMaster
                ? Boolean(localConfigs.discordBot.token)
                : Boolean(cfg.botToken.initialValue);
            if (!hasBotToken) {
                return txToast.error(t('You must provide a Discord Bot Token to enable the bot.'));
            }
            if (!localConfigs.discordBot?.guild) {
                return txToast.error(t('You must provide a Server ID to enable the bot.'));
            }
        }
        pageCtx.saveChanges(cardCtx, localConfigs);
    }

    return (
        <SettingsCardShell
            cardCtx={cardCtx}
            pageCtx={pageCtx}
            onClickSave={handleOnSave}
        >
            <SettingItem label={t('Discord Bot')}>
                <SwitchText
                    id={cfg.botEnabled.eid}
                    checkedLabel={t('Enabled')}
                    uncheckedLabel={t('Disabled')}
                    variant="checkedGreen"
                    checked={states.botEnabled}
                    onCheckedChange={cfg.botEnabled.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    {t('Enable Discord Integration.')}
                </SettingItemDesc>
            </SettingItem>
            {isMaster && <SettingItem label={t('Token')} htmlFor={cfg.botToken.eid} required={states.botEnabled}>
                <Input
                    id={cfg.botToken.eid}
                    ref={botTokenRef}
                    defaultValue={cfg.botToken.initialValue}
                    onInput={updatePageState}
                    disabled={pageCtx.isReadOnly}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxx.xxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    maxLength={96}
                    autoComplete="off"
                    className="blur-input"
                    required
                />
                <SettingItemDesc>
                    {t('To get a token and the bot to join your server, follow these two guides:')} <br />
                    <TransText k="[Setting up a bot application](https://discordjs.guide/legacy/preparations/app-setup) and [Adding your bot to servers](https://discordjs.guide/legacy/preparations/adding-your-app)" /> <br />
                    <TransText k="**Note:** Do not reuse the same token for another bot." /> <br />
                    <TransText k="**Note:** The bot requires the **Server Members** intent, which can be set at the [Discord Developer Portal](https://discord.com/developers/applications)." />
                </SettingItemDesc>
            </SettingItem>}
            <SettingItem label={t('Guild/Server ID')} htmlFor={cfg.discordGuild.eid} required={states.botEnabled}>
                <Input
                    id={cfg.discordGuild.eid}
                    ref={discordGuildRef}
                    defaultValue={cfg.discordGuild.initialValue}
                    onInput={updatePageState}
                    disabled={pageCtx.isReadOnly}
                    placeholder='000000000000000000'
                />
                <SettingItemDesc>
                    {t('The ID of the Discord Server (also known as Discord Guild).')} <br />
                    <TransText k={"To get the Server ID, go to Discord's settings and [enable developer mode](https://support.discordapp.com/hc/article_attachments/115002742731/mceclip0.png), then right-click on the guild icon select \"Copy ID\"."} />
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Warnings Channel ID')} htmlFor={cfg.warningsChannel.eid} showOptional>
                <Input
                    id={cfg.warningsChannel.eid}
                    ref={warningsChannelRef}
                    defaultValue={cfg.warningsChannel.initialValue}
                    onInput={updatePageState}
                    disabled={pageCtx.isReadOnly}
                    placeholder='000000000000000000'
                />
                <SettingItemDesc>
                    {t('The ID of the channel to send Announcements (eg server restarts).')} <br />
                    {t('You can leave it blank to disable this feature.')} <br />
                    <TransText k={"To get the channel ID, go to Discord's settings and [enable developer mode](https://support.discordapp.com/hc/article_attachments/115002742731/mceclip0.png), then right-click on the channel name and select \"Copy ID\"."} />
                </SettingItemDesc>
            </SettingItem>
        </SettingsCardShell>
    )
}
