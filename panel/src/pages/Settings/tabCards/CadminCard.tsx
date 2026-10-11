import { useEffect, useMemo, useReducer, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Section from '@/components/Section';
import { SettingItem, SettingItemDesc } from '../settingsItems';
import SettingsCardShell from '../SettingsCardShell';
import { configsReducer, getConfigAccessors, getConfigDiff, getConfigEmptyState, getPageConfig, type SettingsCardProps } from '../utils';
import { useAdminPerms } from '@/hooks/auth';
import { useBackendApi } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import { t } from '@/lib/i18n';
import { reloadPanel } from '@/lib/navigation';

const pageConfigs = {
    enabled: getPageConfig('cadmin', 'enabled'),
    apiUrl: getPageConfig('cadmin', 'apiUrl'),
    apiSecret: getPageConfig('cadmin', 'apiSecret'),
    dirtyMoneyItem: getPageConfig('cadmin', 'dirtyMoneyItem'),
    framework: getPageConfig('cadmin', 'framework'),
} as const;

type ActionResponse = { success: boolean; error?: string; data?: any };

export default function CadminCard({ cardCtx, pageCtx }: SettingsCardProps) {
    const { isMaster } = useAdminPerms();
    const [working, setWorking] = useState(false);
    const [states, dispatch] = useReducer(configsReducer<typeof pageConfigs>, null, () => getConfigEmptyState(pageConfigs));
    const cfg = useMemo(() => getConfigAccessors(cardCtx.cardId, pageConfigs, pageCtx.apiData, dispatch), [pageCtx.apiData, dispatch]);
    const actionApi = useBackendApi<ActionResponse, any>({ method: 'POST', path: '/api/cadmin/install/:action' });

    const updatePageState = () => {
        const result = getConfigDiff(cfg, states, {}, false);
        pageCtx.setCardPendingSave(result.hasChanges ? cardCtx : null);
        return result;
    };
    useEffect(() => { updatePageState(); }, [states]);

    if (!isMaster) return <Section title={cardCtx.cardTitle}>
        <p className="text-sm text-muted-foreground">{t('Only the master can configure Character Management.')}</p>
    </Section>;

    const runAction = async (action: 'install' | 'test') => {
        setWorking(true);
        try {
            const response = await actionApi({ pathParams: { action }, data: action === 'install' ? { framework: states.framework, dirtyMoneyItem: states.dirtyMoneyItem } : {} });
            if (!response?.success) throw new Error(response?.error || t('The action failed.'));
            if (action === 'install') {
                txToast.success(response.data?.started
                    ? t('Character Management installed and started on the server. Reloading this page…')
                    : t('Character Management installed. It loads the next time the server starts. Reloading this page…'));
                window.setTimeout(reloadPanel, 900);
            } else txToast.success(t('Connected to {name}.', { name: response.data?.framework || 'cadminpanel' }));
        } catch (error) { txToast.error(error instanceof Error ? t(error.message) : t('The action failed.')); }
        finally { setWorking(false); }
    };
    const handleSave = () => {
        const { hasChanges, localConfigs } = updatePageState();
        if (hasChanges) pageCtx.saveChanges(cardCtx, localConfigs);
    };

    return <SettingsCardShell cardCtx={cardCtx} pageCtx={{ ...pageCtx, isReadOnly: pageCtx.isReadOnly || working }} onClickSave={handleSave}>
        <SettingItem label={t('Enabled')} htmlFor={cfg.enabled.eid}>
            <Switch
                id={cfg.enabled.eid}
                checked={states.enabled ?? false}
                onCheckedChange={value => dispatch({ configName: 'enabled', configValue: value })}
            />
            <SettingItemDesc>{t('Enables Character Management pages and the bridge API. Staff access still comes only from local panel permissions.')}</SettingItemDesc>
        </SettingItem>
        <SettingItem label={t('Framework')} htmlFor={cfg.framework.eid}>
            <Select value={states.framework ?? 'auto'} onValueChange={value => dispatch({ configName: 'framework', configValue: value })}>
                <SelectTrigger id={cfg.framework.eid}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="auto">{t('Auto-detect')}</SelectItem>
                    <SelectItem value="esx">ESX</SelectItem>
                    <SelectItem value="qbox">Qbox</SelectItem>
                </SelectContent>
            </Select>
            <SettingItemDesc>{t('Only ESX and Qbox have a bridge adapter, and both are FiveM frameworks. There is nothing to connect to on a RedM server.')}</SettingItemDesc>
        </SettingItem>
        <SettingItem label={t('Bridge URL')} htmlFor={cfg.apiUrl.eid}>
            <Input id={cfg.apiUrl.eid} value={states.apiUrl ?? ''} onChange={event => dispatch({ configName: 'apiUrl', configValue: event.target.value })} placeholder="http://127.0.0.1:30120/cadminpanel" />
        </SettingItem>
        <SettingItem label={t('Shared secret')} htmlFor={cfg.apiSecret.eid}>
            <Input id={cfg.apiSecret.eid} type="password" autoComplete="off" value={states.apiSecret ?? ''} onChange={event => dispatch({ configName: 'apiSecret', configValue: event.target.value })} />
        </SettingItem>
        <SettingItem label={t('Dirty money item')} htmlFor={cfg.dirtyMoneyItem.eid}>
            <Input id={cfg.dirtyMoneyItem.eid} value={states.dirtyMoneyItem ?? ''} onChange={event => dispatch({ configName: 'dirtyMoneyItem', configValue: event.target.value })} />
        </SettingItem>
        <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={working || !pageCtx.apiData} onClick={() => runAction('install')}>{t('Install & configure now')}</Button>
            <Button type="button" variant="secondary" disabled={working || !states.enabled} onClick={() => runAction('test')}>{t('Test connection')}</Button>
        </div>
    </SettingsCardShell>;
}
