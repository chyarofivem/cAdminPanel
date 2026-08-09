import { useState } from "react";
import useSWR from "swr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setUrlHash as setUrlHashOriginal } from "@/lib/navigation";
import { Settings2Icon } from "lucide-react";

import { ApiTimeout, useBackendApi } from "@/hooks/fetch";
import { useOpenConfirmDialog } from "@/hooks/dialogs";
import { txToast } from "@/components/TxToaster";
import { useAdminPerms } from "@/hooks/auth";
import { SYM_RESET_CONFIG, type SettingsCardContext, type SettingsCardInfo, type SettingsCardProps, type SettingsTabInfo } from "./utils";
import type { GetConfigsResp, PartialTxConfigs, SaveConfigsReq, SaveConfigsResp } from "@shared/otherTypes";

import SettingsTab from "./SettingsTab";
import ConfigCardBans from "./tabCards/bans";
import ConfigCardDiscord from "./tabCards/discord";
import ConfigCardFxserver from "./tabCards/fxserver";
import ConfigCardGameMenu from "./tabCards/gameMenu";
import ConfigCardGameNotifications from "./tabCards/gameNotifications";
import ConfigCardGeneral from "./tabCards/general";
import ConfigCardWhitelist from "./tabCards/whitelist";
import AppearanceCard from "./tabCards/AppearanceCard";
import CadminCard from "./tabCards/CadminCard";
import SettingsCardTemplate from "./tabCards/_template";
import SettingsCardBlank from "./tabCards/_blank";
import { PageHeader, PageHeaderChangelog } from "@/components/page-header";
import { t } from "@/lib/i18n";



//Tab configuration
const settingsTabsBase = [
    { id: 'general', name: t('General'), Component: ConfigCardGeneral }, //TODO: cards [Server Listing, txAdmin]
    { id: 'appearance', name: t('Appearance'), Component: AppearanceCard },
    { id: 'cadmin', name: t('Character Management'), Component: CadminCard },
    { id: 'fxserver', name: t('FXServer'), Component: ConfigCardFxserver },
    { id: 'bans', name: t('Bans'), Component: ConfigCardBans },
    { id: 'whitelist', name: t('Allowlist'), Component: ConfigCardWhitelist },
    { id: 'discord', name: t('Discord'), Component: ConfigCardDiscord },
    {
        id: 'game',
        name: t('Game'),
        cards: [
            { id: 'menu', name: t('Menu'), Component: ConfigCardGameMenu },
            { id: 'notifications', name: t('Notifications'), Component: ConfigCardGameNotifications },
        ]
    },
    //Dev only
    // { name: 'Template', Component: SettingsCardTemplate },
    // { name: 'Blank', Component: SettingsCardBlank },
]


//Types
type SettingGroup = {
    ctx: SettingsTabInfo & SettingsCardInfo;
    Component: React.FC<SettingsCardProps>;
};
type SettingTabMulti = {
    ctx: SettingsTabInfo;
    cards: SettingGroup[];
};
type SettingTabSingle = SettingGroup;
export type SettingTabsDatum = SettingTabMulti | SettingTabSingle;


//Massaging the data into the expected format
export const settingsTabs: SettingTabsDatum[] = settingsTabsBase.map((tab) => {
    const tabCtx = {
        tabId: tab.id,
        tabName: tab.name,
    } satisfies SettingsTabInfo;
    if ('cards' in tab && tab.cards) {
        return {
            ctx: tabCtx,
            cards: tab.cards.map((card) => ({
                ctx: {
                    ...tabCtx,
                    cardId: `${tabCtx.tabId}-${card.id}`,
                    cardName: card.name,
                    cardTitle: `${tabCtx.tabName} ${card.name}`,
                },
                Component: card.Component,
            } satisfies SettingGroup)),
        } satisfies SettingTabMulti;
    } else {
        return {
            ctx: {
                ...tabCtx,
                cardId: tabCtx.tabId,
                cardName: tabCtx.tabName,
                cardTitle: tabCtx.tabName,
            },
            Component: tab.Component,
        } satisfies SettingTabSingle;
    }
});


export default function SettingsPage({ embeddedAllowlist = false }: { embeddedAllowlist?: boolean }) {
    const displayedTabs = embeddedAllowlist
        ? settingsTabs.filter(tab => tab.ctx.tabId === 'whitelist')
        : settingsTabs.filter(tab => tab.ctx.tabId !== 'whitelist');
    const [cardPendingSave, setCardPendingSave] = useState<SettingsCardContext | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const openConfirmDialog = useOpenConfirmDialog();
    const { hasPerm } = useAdminPerms();

    // FIXME:NEXT:UPDATE remove
    const setUrlHash = (hash: string) => {
        if (hash === 'whitelist') {
            hash = 'allowlist';
        }
        setUrlHashOriginal(hash);
    }

    //Check for default tab in URL hash
    const [tab, setTab] = useState(() => {
        const pageHash = window.location?.hash.slice(1);

        // FIXME:NEXT:UPDATE remove
        const requestedTab = pageHash === 'allowlist'
            ? 'whitelist'
            : pageHash === 'character-management'
                ? 'cadmin'
                : pageHash;
        if (pageHash === 'whitelist') setUrlHash('allowlist');

        return displayedTabs.find(tab => tab.ctx.tabId === requestedTab)?.ctx.tabId ?? displayedTabs[0].ctx.tabId;
    });


    //API stuff
    const queryApi = useBackendApi<GetConfigsResp>({
        method: 'GET',
        path: `/settings/configs`,
        throwGenericErrors: true,
    });
    const saveApi = useBackendApi<SaveConfigsResp, SaveConfigsReq>({
        method: 'POST',
        path: `/settings/configs/:card`,
        throwGenericErrors: true,
    });

    const swr = useSWR('/settings/configs', async () => {
        const data = await queryApi({});
        if (!data) throw new Error('No data returned');
        return data;
    }, {
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });


    //Handlers
    const saveChanges = async (source: SettingsCardContext, changes: PartialTxConfigs) => {
        if (isSaving) return;
        const toastId = txToast.loading(`Saving ${source.cardTitle} settings...`, { id: 'settingsSave' });
        setIsSaving(true);
        try {
            if (!swr.data) throw new Error('Cannot save changes without swr.data.');
            const resetKeys: string[] = [];
            for (const [scopeName, scopeData] of Object.entries(changes)) {
                for (const [configKey, configValue] of Object.entries(scopeData)) {
                    if (configValue === SYM_RESET_CONFIG) {
                        resetKeys.push(`${scopeName}.${configKey}`);
                    }
                }
            }
            const saveResp = await saveApi({
                pathParams: { card: source.cardId },
                data: { resetKeys, changes },
                timeout: source.cardId === 'discord'
                    ? ApiTimeout.REALLY_REALLY_LONG
                    : ApiTimeout.LONG,
                toastId,
            });
            if (!saveResp) throw new Error('empty_response');
            if (saveResp.type === 'error') return; //the fetcher will handle the error
            if (!saveResp.stored) throw new Error('no_stored_data');
            if (!saveResp.changelog) throw new Error('no_changelog_data');
            swr.mutate({
                ...swr.data,
                storedConfigs: saveResp.stored,
                changelog: saveResp.changelog,
            }, false);
            setCardPendingSave(null);
            if (
                source.cardId === 'general'
                && typeof changes.general?.language === 'string'
                && changes.general.language !== window.txConsts.uiLocale
            ) {
                window.location.reload();
            }
        } catch (error) {
            txToast.error({
                title: `Error saving ${source.cardTitle} settings:`,
                msg: (error as any).message,
            }, { id: toastId });
        } finally {
            setIsSaving(false);
        }
    }

    const switchTab = (newTab: string) => {
        setCardPendingSave(null);
        setTab(newTab);
        setUrlHash(newTab);
    }

    //If switching tabs with unsaved changes, ask for confirmation
    const handleTabChange = (newTab: string) => {
        if (cardPendingSave && newTab && newTab !== cardPendingSave?.tabId) {
            openConfirmDialog({
                title: 'Discard Changes',
                actionLabel: 'Discard',
                confirmBtnVariant: 'destructive',
                message: (<>
                    You have unsaved changes in the <strong>{cardPendingSave.cardTitle}</strong> tab. <br />
                    Are you sure you want to discard them?
                </>),
                onConfirm: () => {
                    switchTab(newTab);
                },
            });
        } else {
            switchTab(newTab);
        }
    }


    return (
        <div className="w-full mb-10">
            {!embeddedAllowlist && <PageHeader title={t('Settings')} icon={<Settings2Icon />}>
                <PageHeaderChangelog changelogData={swr?.data?.changelog} />
            </PageHeader>}
            <div className="px-0 xs:px-3 md:px-0 flex flex-row gap-2 w-full">
                <Tabs
                    value={tab}
                    onValueChange={handleTabChange}
                    className="w-full"
                >
                    {!embeddedAllowlist && <TabsList
                        className="max-xs:sticky max-xs:top-navbarvh z-10 flex-wrap h-[unset] max-xs:w-full max-xs:rounded-none"
                    >
                        {displayedTabs.map((tab) => (
                            <TabsTrigger
                                key={tab.ctx.tabId}
                                value={tab.ctx.tabId}
                                className="hover:text-primary"
                            >
                                {tab.ctx.tabName}

                                {/* <TriangleAlertIcon className="inline-block size-4 mt-0.5 ml-1 text-destructive self-center" /> */}
                                {/* <DynamicNewBadge size='xs' featName="ignore" /> */}
                            </TabsTrigger>
                        ))}
                    </TabsList>}
                    {displayedTabs.map((tab) => (
                        <TabsContent value={tab.ctx.tabId} key={tab.ctx.tabId} className="mt-6">
                            <SettingsTab
                                tab={tab}
                                pageCtx={{
                                    apiData: swr.data,
                                    isReadOnly: swr.isLoading || isSaving || !swr.data || !hasPerm(tab.ctx.tabId === 'appearance' ? 'settings.appearance' : 'settings.write'),
                                    isLoading: swr.isLoading,
                                    isSaving,
                                    swrError: swr.error ? swr.error.message : undefined,
                                    cardPendingSave,
                                    setCardPendingSave,
                                    saveChanges,
                                }}
                            />
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    )
}
