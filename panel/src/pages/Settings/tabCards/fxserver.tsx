import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import SwitchText from '@/components/SwitchText'
import { AdvancedDivider, SettingItem, SettingItemDesc } from '../settingsItems'
import { useState, useEffect, useRef, useMemo, useReducer } from "react"
import { getConfigEmptyState, getConfigAccessors, SettingsCardProps, getPageConfig, configsReducer, getConfigDiff, type PageConfigReducerAction } from "../utils"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { TimeInputDialog } from "@/components/TimeInputDialog"
import SettingsCardShell from "../SettingsCardShell"
import { cn } from "@/lib/utils"
import { txToast } from "@/components/TxToaster"
import { useBackendApi } from "@/hooks/fetch"
import { useAdminPerms } from "@/hooks/auth"
import { useLocation } from "wouter"
import type { ResetServerDataPathResp } from "@shared/otherTypes"
import { useOpenConfirmDialog } from "@/hooks/dialogs"
import { t } from "@/lib/i18n"
import TransText from "@/components/TransText"


// Remove duplicates and sort times
function sanitizeTimes(times: string[]): string[] {
    const uniqueTimes = Array.from(new Set(times));
    return uniqueTimes.sort((a, b) => {
        const [aHours, aMinutes] = a.split(':').map(Number);
        const [bHours, bMinutes] = b.split(':').map(Number);
        return aHours - bHours || aMinutes - bMinutes;
    });
}


type RestartScheduleBoxProps = {
    restartTimes: string[] | undefined;
    setRestartTimes: (val: PageConfigReducerAction<string[]|undefined>['configValue']) => void;
    disabled?: boolean;
};

const restartPresets = [
    { label: '1x', times: ['00:00'] },
    { label: '2x', times: ['00:00', '12:00'] },
    { label: '3x', times: ['00:00', '08:00', '16:00'] },
    { label: '4x', times: ['00:00', '06:00', '12:00', '18:00'] },
];

export function RestartScheduleBox({ restartTimes, setRestartTimes, disabled }: RestartScheduleBoxProps) {
    const [isTimeInputOpen, setIsTimeInputOpen] = useState(false);

    const addTime = (time: string) => {
        if (!restartTimes || disabled) return;
        setRestartTimes(prev => sanitizeTimes([...prev ?? [], time]));
    };
    const removeTime = (index: number) => {
        if (!restartTimes || disabled) return;
        setRestartTimes(prev => sanitizeTimes((prev ?? []).filter((_, i) => i !== index)));
    };
    const applyPreset = (presetTimes: string[]) => {
        if (!restartTimes || disabled) return;
        setRestartTimes(presetTimes);
    };
    const clearTimes = () => {
        if (disabled) return;
        setRestartTimes([]);
    };

    return (
        <div className="flex flex-col gap-3">
            {restartTimes && restartTimes.length === 0 && (
                <div className="text-dense text-muted-foreground">
                    <p>{t('No restarts scheduled.')}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{t('Presets')}:</span>
                        {restartPresets.map((preset) => (
                            <Button
                                key={preset.label}
                                variant="link"
                                disabled={disabled}
                                onClick={() => applyPreset(preset.times)}
                            >
                                <span className="text-dense">{preset.label}{t('/day')}</span>
                            </Button>
                        ))}
                    </div>
                </div>
            )}
            {restartTimes && restartTimes.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label={t('Restart Schedule')}>
                    {restartTimes.map((time, index) => (
                        <li
                            key={time}
                            className={cn(
                                'flex min-h-9 select-none items-center gap-1 rounded-sm bg-raise-2 text-sm',
                                disabled ? 'px-3' : 'pl-3',
                            )}
                        >
                            <span className="font-mono tabular-nums text-white">{time}</span>
                            {!disabled && <IconButton
                                label={t('Remove {time}', { time })}
                                icon={<XIcon />}
                                onClick={() => removeTime(index)}
                            />}
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="secondary"
                    onClick={() => setIsTimeInputOpen(true)}
                    disabled={disabled}
                >
                    {t('Add time')}
                </Button>
                <Button
                    variant="outline-destructive"
                    onClick={() => clearTimes()}
                    disabled={disabled || !restartTimes || restartTimes.length === 0}
                >
                    {t('Clear')}
                </Button>
            </div>
            <TimeInputDialog
                title={t('Add Restart Time')}
                isOpen={isTimeInputOpen}
                onClose={() => setIsTimeInputOpen(false)}
                onSubmit={addTime}
            />
        </div>
    )
}


const getServerDataPlaceholder = (hostSuggested?: string) => {
    if (hostSuggested) {
        const withoutTailSlash = hostSuggested.replace(/\/$/, '');
        return `${withoutTailSlash}/CFXDefault`;
    } else if (window.txConsts.isWindows) {
        return 'C:/Users/Admin/Desktop/CFXDefault';
    } else {
        return '/root/fivem/txData/CFXDefault';
    }
}

// Check if the browser timezone is different from the server timezone
export function TimeZoneWarning() {
    try {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (window.txConsts.serverTimezone !== browserTimezone) {
            return (
                <SettingItemDesc className="text-warning-text">
                    <TransText
                        k="**Warning:** Your server timezone is set to `{serverTimezone}`, but your browser timezone is `{browserTimezone}`. Make sure to configure the time according to the server timezone."
                        values={{ serverTimezone: window.txConsts.serverTimezone, browserTimezone }}
                    />
                </SettingItemDesc>
            );
        }
    } catch (error) {
        console.error(error);
    }
    return null;
}


export const pageConfigs = {
    dataPath: getPageConfig('server', 'dataPath'),
    quietMode: getPageConfig('server', 'quiet'),

    cfgPath: getPageConfig('server', 'cfgPath', true),
    startupArgs: getPageConfig('server', 'startupArgs', true),
    onesync: getPageConfig('server', 'onesync', true),
    autoStart: getPageConfig('server', 'autoStart', true),
    resourceTolerance: getPageConfig('restarter', 'resourceStartingTolerance', true),
} as const;

export default function ConfigCardFxserver({ cardCtx, pageCtx }: SettingsCardProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isResettingServerData, setIsResettingServerData] = useState(false);
    const { hasPerm } = useAdminPerms();
    const setLocation = useLocation()[1];
    const openConfirmDialog = useOpenConfirmDialog();
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
    const dataPathRef = useRef<HTMLInputElement | null>(null);
    const cfgPathRef = useRef<HTMLInputElement | null>(null);
    const startupArgsRef = useRef<HTMLInputElement | null>(null);
    const forceQuietMode = pageCtx.apiData?.forceQuietMode;

    //Marshalling Utils
    const selectNumberUtil = {
        toUi: (num?: number) => num ? num.toString() : undefined,
        toCfg: (str?: string) => str ? parseInt(str) : undefined,
    }
    const inputArrayUtil = {
        toUi: (args?: string[]) => args ? args.join(' ') : '',
        toCfg: (str?: string) => str ? str.trim().split(/\s+/) : [],
    }
    const emptyToNull = (str?: string) => {
        if (str === undefined) return undefined;
        const trimmed = str.trim();
        return trimmed.length ? trimmed : null;
    };

    //Processes the state of the page and sets the card as pending save if needed
    const updatePageState = () => {
        let currStartupArgs;
        if (startupArgsRef.current) {
            currStartupArgs = inputArrayUtil.toCfg(startupArgsRef.current.value);
        }
        let currDataPath;
        if (dataPathRef.current?.value) {
            currDataPath = dataPathRef.current.value.replace(/\\/g, '/').replace(/\/\/+/, '/');
            if (currDataPath.endsWith('/')) {
                currDataPath = currDataPath.slice(0, -1);
            }
        }
        const overwrites = {
            dataPath: emptyToNull(dataPathRef.current?.value),
            cfgPath: cfgPathRef.current?.value,
            startupArgs: currStartupArgs,
        };

        const res = getConfigDiff(cfg, states, overwrites, showAdvanced);
        pageCtx.setCardPendingSave(res.hasChanges ? cardCtx : null);
        return res;
    }

    //Validate changes (for UX only) and trigger the save API
    const handleOnSave = () => {
        const { hasChanges, localConfigs } = updatePageState();
        if (!hasChanges) return;

        if (!localConfigs.server?.dataPath) {
            return txToast.error({
                title: t('The Server Data Folder is required.'),
                md: true,
                msg: t('If you want to return to the Setup page, click on the "Reset" button instead.'),
            });
        }
        if (localConfigs.server.cfgPath !== undefined && !localConfigs.server.cfgPath) {
            return txToast.error({
                title: t('The CFG File Path is required.'),
                md: true,
                msg: t('The value should probably be `server.cfg`.'),
            });
        }
        if (
            Array.isArray(localConfigs.server?.startupArgs)
            && localConfigs.server.startupArgs.some((arg) => arg.toLowerCase() === 'onesync')
        ) {
            return txToast.error({
                title: t('You cannot set OneSync in Startup Arguments.'),
                md: true,
                msg: t('Please use the selectbox below it.'),
            });
        }
        pageCtx.saveChanges(cardCtx, localConfigs);
    }

    //Card content stuff
    const serverDataPlaceholder = useMemo(
        () => getServerDataPlaceholder(pageCtx.apiData?.dataPath),
        [pageCtx.apiData]
    );

    //Reset server server data button
    const resetServerDataApi = useBackendApi<ResetServerDataPathResp>({
        method: 'POST',
        path: `/settings/resetServerDataPath`,
        throwGenericErrors: true,
    });
    const handleResetServerData = () => {
        openConfirmDialog({
            title: t('Reset Server Data Path'),
            message: (<>
                {t('Are you sure you want to reset the server data path?')} <br />
                <br />
                <TransText k="**This will not delete any resource files or database**, but just reset the cAdminPanel configuration, allowing you to go back to the Setup page." /> <br />
                {t('If you want, you can set the path back to the current value later.')} <br />
                <br />
                <strong className="text-warning-text">{t('Warning:')}</strong> {t('take note of the current path before proceeding, so you can set it back later if you need to. Current path:')}
                <Input value={cfg.dataPath.initialValue} className="mt-2" readOnly />
            </>),
            onConfirm: () => {
                setIsResettingServerData(true);
                resetServerDataApi({
                    toastLoadingMessage: t('Resetting server data path...'),
                    success: (data, toastId) => {
                        if (data.type === 'success') {
                            setLocation('/server/setup');
                        }
                    },
                    finally: () => setIsResettingServerData(false),
                });
            },
        });

    }

    // cfg.restarterSchedule.state.set(['00:00', '12:00'])
    // cfg.restarterSchedule.state.set([])
    // cfg.restarterSchedule.state.set(undefined)

    return (
        <SettingsCardShell
            cardCtx={cardCtx}
            pageCtx={pageCtx}
            onClickSave={handleOnSave}
            advancedVisible={showAdvanced}
            advancedSetter={setShowAdvanced}
        >
            <SettingItem label={t('Server Data Folder')} htmlFor={cfg.dataPath.eid} required>
                <div className="flex gap-2">
                    <Input
                        id={cfg.dataPath.eid}
                        ref={dataPathRef}
                        defaultValue={cfg.dataPath.initialValue}
                        placeholder={serverDataPlaceholder}
                        onInput={updatePageState}
                        disabled={pageCtx.isReadOnly}
                        className="min-w-0 flex-1"
                        required
                    />
                    <Button
                        className="shrink-0"
                        variant="outline-destructive"
                        disabled={pageCtx.isReadOnly || !hasPerm('all_permissions') || isResettingServerData}
                        onClick={handleResetServerData}
                    >
                        {t('Reset')}
                    </Button>
                </div>
                <SettingItemDesc>
                    <TransText k="The full path of the folder that **contains** the `resources` folder, usually it's the same place that contains your `server.cfg`." /> <br />
                    {t('Resetting this value will allow you to go back to the Setup page, without deleting any files.')}
                    {pageCtx.apiData?.dataPath && pageCtx.apiData?.hasCustomDataPath && (<>
                        <br />
                        <span className="text-warning-text">
                            <TransText
                                k="{source}: This path should start with `{path}`."
                                values={{ source: window.txConsts.hostConfigSource, path: pageCtx.apiData.dataPath }}
                            />
                        </span>
                    </>)}
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Quiet Mode')}>
                <SwitchText
                    id={cfg.quietMode.eid}
                    checkedLabel={t('Enabled')}
                    uncheckedLabel={t('Disabled')}
                    checked={forceQuietMode || states.quietMode}
                    onCheckedChange={cfg.quietMode.state.set}
                    disabled={pageCtx.isReadOnly || forceQuietMode}
                />
                <SettingItemDesc>
                    {t("Do not print FXServer's output to the terminal.")} <br />
                    {t('You will still be able to use the Live Console.')}
                    {forceQuietMode && (<>
                        <br />
                        <span className="text-warning-text">{t('{source}: This setting is locked and cannot be changed.', { source: window.txConsts.hostConfigSource })}</span>
                    </>)}
                </SettingItemDesc>
            </SettingItem>

            {showAdvanced && <AdvancedDivider />}

            <SettingItem label={t('CFG File Path')} htmlFor={cfg.cfgPath.eid} showIf={showAdvanced} required>
                <Input
                    id={cfg.cfgPath.eid}
                    ref={cfgPathRef}
                    defaultValue={cfg.cfgPath.initialValue}
                    placeholder="server.cfg"
                    onInput={updatePageState}
                    disabled={pageCtx.isReadOnly}
                    required
                />
                <SettingItemDesc>
                    <TransText k="The path to your server config file, probably named `server.cfg`." /> <br />
                    {t('This can either be absolute, or relative to the Server Data folder.')}
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Startup Arguments')} htmlFor={cfg.startupArgs.eid} showIf={showAdvanced}>
                <Input
                    id={cfg.startupArgs.eid}
                    ref={startupArgsRef}
                    defaultValue={inputArrayUtil.toUi(cfg.startupArgs.initialValue)}
                    placeholder="--trace-warning"
                    onInput={updatePageState}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    {t('Additional command-line arguments to pass to the FXServer instance such as NodeJS CLI flags.')} <br />
                    <TransText k="**Warning:** You almost certainly should not use this option, commands and convars should be placed in your `server.cfg` instead." />
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label="OneSync" htmlFor={cfg.onesync.eid} showIf={showAdvanced}>
                <Select
                    value={states.onesync}
                    onValueChange={cfg.onesync.state.set as any}
                    disabled={pageCtx.isReadOnly}
                >
                    <SelectTrigger id={cfg.onesync.eid}>
                        <SelectValue placeholder={t('Select OneSync option')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="on">{t('On (recommended)')}</SelectItem>
                        <SelectItem value="legacy">{t('Legacy')}</SelectItem>
                        <SelectItem value="off">{t('Off')}</SelectItem>
                    </SelectContent>
                </Select>
                <SettingItemDesc>
                    <TransText k="Most servers should be using **OneSync On**." /> <br />
                    <TransText k="The other options are considered deprecated and should not be used unless you know what you're doing. RedM servers only support **On**." /> <br />
                    <TransText k="For more information, please read the [documentation](https://docs.fivem.net/docs/scripting-reference/onesync/)." />
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Autostart')} showIf={showAdvanced}>
                <SwitchText
                    id={cfg.autoStart.eid}
                    checkedLabel={t('Enabled')}
                    uncheckedLabel={t('Disabled')}
                    checked={states.autoStart}
                    onCheckedChange={cfg.autoStart.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    <TransText k="Start the server automatically after **cAdminPanel** starts." />
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label={t('Resource Starting Tolerance')} htmlFor={cfg.resourceTolerance.eid} showIf={showAdvanced}>
                <Select
                    value={selectNumberUtil.toUi(states.resourceTolerance)}
                    onValueChange={(val) => cfg.resourceTolerance.state.set(selectNumberUtil.toCfg(val))}
                    disabled={pageCtx.isReadOnly}
                >
                    <SelectTrigger id={cfg.resourceTolerance.eid}>
                        <SelectValue placeholder={t('Select...')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="90">{t('1.5 minutes (default)')}</SelectItem>
                        <SelectItem value="180">{t('3 minutes')}</SelectItem>
                        <SelectItem value="300">{t('5 minutes')}</SelectItem>
                        <SelectItem value="600">{t('10 minutes')}</SelectItem>
                    </SelectContent>
                </Select>
                <SettingItemDesc>
                    {t('At server boot, how much time to wait for any single resource to start before restarting the server.')} <br />
                    <TransText k="**Note:** If you are getting `failed to start in time` errors, increase this value." />
                </SettingItemDesc>
            </SettingItem>
        </SettingsCardShell>
    )
}
