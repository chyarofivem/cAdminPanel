import { useEffect, useState } from 'react';
import type { ResourceMonitorActionResp, ResourceMonitorConfig, ResourceMonitorSettingsReq } from '@shared/resourceMonitorTypes';
import Section from '@/components/Section';
import SwitchText from '@/components/SwitchText';
import { txToast } from '@/components/TxToaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthedFetcher } from '@/hooks/fetch';
import { t } from '@/lib/i18n';
import { SettingItem, SettingItemDesc, SettingItemWarningLine } from '@/pages/Settings/settingsItems';
import { errorMessage } from './utils';

type SettingsFormProps = {
    config: ResourceMonitorConfig;
    canEdit: boolean;
    discordConfigured: boolean;
    onSaved: () => void;
};

type FormState = {
    enabled: boolean;
    intervalMinutes: string;
    frames: string;
    alertThresholdMs: string;
    alertConsecutive: string;
    discordAlerts: boolean;
};

const intervalOptions = [1, 2, 5, 10, 15, 30, 60];
const consecutiveOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const toFormState = (config: ResourceMonitorConfig): FormState => ({
    enabled: config.enabled,
    intervalMinutes: String(config.intervalMinutes),
    frames: String(config.frames),
    alertThresholdMs: String(config.alertThresholdMs),
    alertConsecutive: String(config.alertConsecutive),
    discordAlerts: config.discordAlerts,
});

const parseNumber = (value: string) => {
    if (value.trim() === '') return Number.NaN;
    return Number(value.trim().replace(',', '.'));
};

const validate = (state: FormState) => {
    const frames = parseNumber(state.frames);
    const threshold = parseNumber(state.alertThresholdMs);
    return {
        frames: Number.isInteger(frames) && frames >= 20 && frames <= 500,
        alertThresholdMs: Number.isFinite(threshold) && threshold >= 0.5 && threshold <= 100,
    };
};


/**
 * The resource monitor settings, next to the feature they control.
 */
export default function SettingsForm({ config, canEdit, discordConfigured, onSaved }: SettingsFormProps) {
    const fetcher = useAuthedFetcher();
    const [state, setState] = useState(() => toFormState(config));
    const [isSaving, setIsSaving] = useState(false);
    const savedState = toFormState(config);
    const isDirty = state.enabled !== config.enabled
        || Number(state.intervalMinutes) !== config.intervalMinutes
        || parseNumber(state.frames) !== config.frames
        || parseNumber(state.alertThresholdMs) !== config.alertThresholdMs
        || Number(state.alertConsecutive) !== config.alertConsecutive
        || state.discordAlerts !== config.discordAlerts;
    const validity = validate(state);
    const isValid = validity.frames && validity.alertThresholdMs;
    const disabled = !canEdit || isSaving;

    //Follow the saved values while the form is untouched
    const configKey = JSON.stringify(savedState);
    const [lastConfigKey, setLastConfigKey] = useState(configKey);
    useEffect(() => {
        if (configKey === lastConfigKey) return;
        setLastConfigKey(configKey);
        if (!isDirty || isSaving) setState(toFormState(config));
    }, [configKey]);

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setState((current) => ({ ...current, [key]: value }));
    };

    const intervalChoices = intervalOptions.includes(config.intervalMinutes)
        ? intervalOptions
        : [...intervalOptions, config.intervalMinutes].sort((a, b) => a - b);

    const handleSave = async () => {
        if (!canEdit || !isDirty || !isValid) return;
        const body: ResourceMonitorSettingsReq = {
            enabled: state.enabled,
            intervalMinutes: Number(state.intervalMinutes),
            frames: parseNumber(state.frames),
            alertThresholdMs: parseNumber(state.alertThresholdMs),
            alertConsecutive: Number(state.alertConsecutive),
            discordAlerts: state.discordAlerts,
        };
        setIsSaving(true);
        try {
            const resp = await fetcher<ResourceMonitorActionResp>('/resourceMonitor/settings', {
                method: 'POST',
                body,
            });
            if ('error' in resp) {
                txToast.error({
                    title: t('Settings not saved'),
                    msg: errorMessage(resp.code, resp.error),
                });
                return;
            }
            txToast.success(t('Resource monitor settings saved.'));
            onSaved();
        } catch (error) {
            txToast.error({
                title: t('Settings not saved'),
                msg: t(error instanceof Error ? error.message : 'Unknown error.'),
            });
        } finally {
            setIsSaving(false);
        }
    };

    return <Section
        title={t('Settings')}
        description={t('Each sample runs the FXServer profiler for the set number of server ticks. The profiler commands show up in the server console.')}
    >
        <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
                event.preventDefault();
                void handleSave();
            }}
        >
            {!canEdit && <p className="text-sm text-muted-foreground">
                {t('You need the settings write permission to change these settings.')}
            </p>}

            <div className="grid gap-6 md:grid-cols-2">
                <SettingItem label={t('Automatic sampling')}>
                    <SwitchText
                        id="resmon-enabled"
                        checkedLabel={t('Enabled')}
                        uncheckedLabel={t('Paused')}
                        checked={state.enabled}
                        onCheckedChange={(checked) => update('enabled', checked)}
                        disabled={disabled}
                    />
                    <SettingItemDesc>{t('Takes a sample on a schedule while the server is running.')}</SettingItemDesc>
                </SettingItem>

                <SettingItem label={t('Interval')} htmlFor="resmon-interval">
                    <Select
                        value={state.intervalMinutes}
                        onValueChange={(value) => update('intervalMinutes', value)}
                        disabled={disabled}
                    >
                        <SelectTrigger id="resmon-interval">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {intervalChoices.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>
                                {minutes === 60 ? t('Every hour') : t('Every {count} min', { count: minutes })}
                            </SelectItem>)}
                        </SelectContent>
                    </Select>
                    <SettingItemDesc>{t('Time between automatic samples.')}</SettingItemDesc>
                </SettingItem>

                <SettingItem label={t('Ticks per sample')} htmlFor="resmon-frames">
                    <Input
                        id="resmon-frames"
                        type="number"
                        inputMode="numeric"
                        min={20}
                        max={500}
                        step={1}
                        value={state.frames}
                        onChange={(event) => update('frames', event.target.value)}
                        className="tabular-nums"
                        aria-invalid={!validity.frames}
                        disabled={disabled}
                    />
                    <SettingItemWarningLine visible={!validity.frames} className="text-dense">
                        {t('Enter a whole number from 20 to 500.')}
                    </SettingItemWarningLine>
                    <SettingItemDesc>{t('Server ticks recorded by each profiler capture.')}</SettingItemDesc>
                </SettingItem>

                <SettingItem label={t('Alert threshold (ms per tick)')} htmlFor="resmon-threshold">
                    <Input
                        id="resmon-threshold"
                        type="number"
                        inputMode="decimal"
                        min={0.5}
                        max={100}
                        step={0.5}
                        value={state.alertThresholdMs}
                        onChange={(event) => update('alertThresholdMs', event.target.value)}
                        className="tabular-nums"
                        aria-invalid={!validity.alertThresholdMs}
                        disabled={disabled}
                    />
                    <SettingItemWarningLine visible={!validity.alertThresholdMs} className="text-dense">
                        {t('Enter a number from 0.5 to 100.')}
                    </SettingItemWarningLine>
                    <SettingItemDesc>{t('A resource at or above this value counts as slow.')}</SettingItemDesc>
                </SettingItem>

                <SettingItem label={t('Slow samples before an alert')} htmlFor="resmon-consecutive">
                    <Select
                        value={state.alertConsecutive}
                        onValueChange={(value) => update('alertConsecutive', value)}
                        disabled={disabled}
                    >
                        <SelectTrigger id="resmon-consecutive">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {consecutiveOptions.map((count) => <SelectItem key={count} value={String(count)}>
                                {count === 1 ? t('1 sample') : t('{count} samples in a row', { count })}
                            </SelectItem>)}
                        </SelectContent>
                    </Select>
                    <SettingItemDesc>{t('A resource alerts once per slow run, then again only after it recovers.')}</SettingItemDesc>
                </SettingItem>

                <SettingItem label={t('Discord alerts')}>
                    <SwitchText
                        id="resmon-discord"
                        checkedLabel={t('On')}
                        uncheckedLabel={t('Off')}
                        checked={state.discordAlerts}
                        onCheckedChange={(checked) => update('discordAlerts', checked)}
                        disabled={disabled}
                    />
                    <SettingItemDesc>
                        {discordConfigured
                            ? t('Posts each alert to the Discord warnings channel.')
                            : t('The Discord bot or its warnings channel is not set up, so alerts stay in the panel.')}
                    </SettingItemDesc>
                </SettingItem>
            </div>

            <div>
                <Button type="submit" disabled={disabled || !isDirty || !isValid}>
                    {isSaving ? t('Saving…') : t('Save settings')}
                </Button>
            </div>
        </form>
    </Section>;
}
