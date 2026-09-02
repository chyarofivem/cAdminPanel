import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from '@/components/ui/button'
import { Link } from 'wouter'
import { PencilIcon } from 'lucide-react'
import SwitchText from '@/components/SwitchText'
import { AdvancedDivider, SettingItem, SettingItemDesc } from '../settingsItems'
import { AutosizeTextarea, AutosizeTextAreaRef } from "@/components/ui/autosize-textarea"
import { useState, useEffect, useRef, useMemo, useReducer } from "react"
import { getConfigEmptyState, getConfigAccessors, SettingsCardProps, getPageConfig, configsReducer, getConfigDiff } from "../utils"
import SettingsCardShell from "../SettingsCardShell"
import { txToast } from "@/components/TxToaster"
import { t } from "@/lib/i18n"
import TransText from "@/components/TransText"


export const pageConfigs = {
    checkingEnabled: getPageConfig('banlist', 'enabled'),
    rejectionMessage: getPageConfig('banlist', 'rejectionMessage'),

    requiredHwids: getPageConfig('banlist', 'requiredHwidMatches', true),
} as const;

export default function ConfigCardBans({ cardCtx, pageCtx }: SettingsCardProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
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
    useEffect(() => {
        if (showAdvanced) return;
        Object.values(cfg).forEach(c => c.isAdvanced && c.state.discard());
    }, [showAdvanced]);

    //Refs for configs that don't use state
    const rejectionMessageRef = useRef<AutosizeTextAreaRef | null>(null);

    //Marshalling Utils
    const selectNumberUtil = {
        toUi: (num?: number) => num ? num.toString() : undefined,
        toCfg: (str?: string) => str ? parseInt(str) : undefined,
    }

    //Processes the state of the page and sets the card as pending save if needed
    const updatePageState = () => {
        const overwrites = {
            rejectionMessage: rejectionMessageRef.current?.textArea.value,
        };

        const res = getConfigDiff(cfg, states, overwrites, showAdvanced);
        pageCtx.setCardPendingSave(res.hasChanges ? cardCtx : null);
        return res;
    }

    //Validate changes (for UX only) and trigger the save API
    const handleOnSave = () => {
        const { hasChanges, localConfigs } = updatePageState();
        if (!hasChanges) return;

        if (
            localConfigs.banlist?.rejectionMessage
            && localConfigs.banlist.rejectionMessage.length > 512
        ) {
            return txToast.error({
                title: t('The Ban Rejection Message is too big.'),
                md: true,
                msg: t('The message must be 512 characters or less.'),
            });
        }
        pageCtx.saveChanges(cardCtx, localConfigs);
    }

    return (
        <SettingsCardShell
            cardCtx={cardCtx}
            pageCtx={pageCtx}
            onClickSave={handleOnSave}
            advancedVisible={showAdvanced}
            advancedSetter={setShowAdvanced}
        >
            <SettingItem label={t('Ban Checking')}>
                <SwitchText
                    id={cfg.checkingEnabled.eid}
                    checkedLabel={t('Enabled')}
                    uncheckedLabel={t('Disabled')}
                    checked={states.checkingEnabled}
                    onCheckedChange={cfg.checkingEnabled.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    {t('Enable checking for ban status on player join.')} <br />
                    <TransText k="**Note:** cAdminPanel bans will not work if this option is disabled." />
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Ban Templates')}>
                <Link asChild href="/settings/ban-templates">
                    <Button
                        size={'sm'}
                        variant="secondary"
                        disabled={pageCtx.isReadOnly}
                    >
                        <PencilIcon className='size-4 mr-1.5 inline-block' /> {t('Edit Ban Templates')}
                    </Button>
                </Link>
                <SettingItemDesc>
                    {t('Configure ban reasons and durations that will appear as dropdown options when banning a player. This is useful for common reasons that happen frequently, like violation of your server rules.')}
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Ban Rejection Message')} htmlFor={cfg.rejectionMessage.eid} showOptional>
                <AutosizeTextarea
                    id={cfg.rejectionMessage.eid}
                    ref={rejectionMessageRef}
                    placeholder={t('You can join http://discord.gg/example to appeal this ban.')}
                    defaultValue={cfg.rejectionMessage.initialValue}
                    onInput={updatePageState}
                    autoComplete="off"
                    minHeight={60}
                    maxHeight={180}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    {t('Optional message to display to a player on the rejection message that shows when they try to connect while being banned.')} <br />
                    {t('If you have a ban appeal process, you can use this field to inform the players.')}
                </SettingItemDesc>
            </SettingItem>

            {showAdvanced && <AdvancedDivider />}

            <SettingItem label={t('Required Ban HWID Matches')} htmlFor={cfg.requiredHwids.eid} showIf={showAdvanced}>
                <Select
                    value={selectNumberUtil.toUi(states.requiredHwids)}
                    onValueChange={(val) => cfg.requiredHwids.state.set(selectNumberUtil.toCfg(val))}
                    disabled={pageCtx.isReadOnly}
                >
                    <SelectTrigger id={cfg.requiredHwids.eid}>
                        <SelectValue placeholder={t('Select...')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">{t('1 - recommended')}</SelectItem>
                        <SelectItem value="2">{t('2 - lax')}</SelectItem>
                        <SelectItem value="3">{t('3 - very lax')}</SelectItem>
                        <SelectItem value="4">{t('4 - virtually disabled')}</SelectItem>
                        <SelectItem value="0">{t('Disable HWID Bans')}</SelectItem>
                    </SelectContent>
                </Select>
                <SettingItemDesc>
                    {t('This option configures how many HWID tokens must match between a player and an existing ban for the player join to be blocked, or can disable HWID Bans entirely.')} <br />
                    {t('Since Hardware ID Tokens are not guaranteed to be unique, there is the possibility of tokens from two players matching without them being related to each other.')} <br />
                    <TransText k="**Note:** Most players have 3 to 6 HWID tokens." />
                </SettingItemDesc>
            </SettingItem>
        </SettingsCardShell>
    )
}
