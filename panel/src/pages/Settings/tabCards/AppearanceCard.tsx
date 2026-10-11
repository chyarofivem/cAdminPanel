import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Button } from '@/components/ui/button';
import AccentPicker from '@/components/AccentPicker';
import { SettingGroupHeading, SettingItem, SettingItemDesc } from '../settingsItems';
import SettingsCardShell from '../SettingsCardShell';
import {
    configsReducer,
    getConfigAccessors,
    getConfigDiff,
    getConfigEmptyState,
    getPageConfig,
    type SettingsCardProps,
    attemptBeautifyJsonString,
} from '../utils';
import { useAccent } from '@/hooks/theme';
import { txToast } from '@/components/TxToaster';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { useAuth } from '@/hooks/auth';
import { Textarea } from '@/components/ui/textarea';
import TransText from '@/components/TransText';

const MAX_UPLOAD_BYTES = 128 * 1024;

export const pageConfigs = {
    accent: getPageConfig('general', 'accent'),
    logoUrl: getPageConfig('general', 'logoUrl'),
    faviconUrl: getPageConfig('general', 'faviconUrl'),
    bannerUrl: getPageConfig('general', 'bannerUrl'),
    embedJson: getPageConfig('discordBot', 'embedJson'),
    embedConfigJson: getPageConfig('discordBot', 'embedConfigJson'),
} as const;

const assetLabels = {
    logoUrl: t('Logo'),
    faviconUrl: t('Favicon'),
    bannerUrl: t('Top-left banner'),
} as const;

const assetRecommendations = {
    logoUrl: t('Recommended: 512 × 512 px, 1:1 aspect ratio.'),
    faviconUrl: t('Recommended: 64 × 64 px, 1:1 aspect ratio.'),
    bannerUrl: t('Recommended: 840 × 256 px, 105:32 aspect ratio.'),
} as const;

const assetKinds = {
    logoUrl: 'logo',
    faviconUrl: 'favicon',
    bannerUrl: 'banner',
} as const;

type AssetKey = keyof typeof assetLabels;

export default function AppearanceCard({ cardCtx, pageCtx }: SettingsCardProps) {
    const [states, dispatch] = useReducer(
        configsReducer<typeof pageConfigs>,
        null,
        () => getConfigEmptyState(pageConfigs),
    );
    const cfg = useMemo(
        () => getConfigAccessors(cardCtx.cardId, pageConfigs, pageCtx.apiData, dispatch),
        [pageCtx.apiData, dispatch],
    );
    const { setAccent } = useAccent();
    const { authData } = useAuth();
    const personalAccentRef = useRef(authData ? authData.accent : undefined);

    useEffect(() => {
        personalAccentRef.current = authData ? authData.accent : undefined;
    }, [authData]);

    const updatePageState = () => {
        const result = getConfigDiff(cfg, states, {}, false);
        pageCtx.setCardPendingSave(result.hasChanges ? cardCtx : null);
        return result;
    };

    useEffect(() => {
        updatePageState();
        if (states.accent) setAccent(states.accent);
    }, [states]);

    useEffect(() => () => {
        setAccent(personalAccentRef.current || window.txConsts.accent);
    }, []);

    const readUpload = (key: AssetKey, file?: File) => {
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
            return txToast.error(t('{asset} must be 128 KB or smaller.', { asset: assetLabels[key] }));
        }
        const reader = new FileReader();
        reader.onerror = () => txToast.error(t('Could not read {asset}.', { asset: assetLabels[key].toLowerCase() }));
        reader.onload = () => {
            if (typeof reader.result !== 'string') return;
            dispatch({ configName: key, configValue: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const previewUrl = (key: AssetKey) => {
        const value = states[key];
        if (typeof value === 'string' && value.startsWith('data:')) return value;
        if (typeof value !== 'string') return window.txConsts[key];
        const url = new URL(window.txConsts[key], window.location.href);
        url.search = '';
        url.searchParams.set('v', value || states.accent || 'blue');
        if (value === '') url.searchParams.set('default', '1');
        return url.toString();
    };

    const handleSave = () => {
        const { hasChanges, localConfigs } = updatePageState();
        if (hasChanges) pageCtx.saveChanges(cardCtx, localConfigs);
    };

    return (
        <SettingsCardShell cardCtx={cardCtx} pageCtx={pageCtx} onClickSave={handleSave}>
            <SettingItem label={t('Accent colour')} htmlFor={cfg.accent.eid}>
                <AccentPicker
                    id={cfg.accent.eid}
                    value={states.accent ?? ''}
                    onChange={(value) => dispatch({ configName: 'accent', configValue: value })}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    {t('The preview applies immediately and is saved for web and in-game surfaces.')}
                </SettingItemDesc>
            </SettingItem>

            {(Object.keys(assetLabels) as AssetKey[]).map(key => (
                <SettingItem key={key} label={assetLabels[key]}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className={cn(
                            'flex h-20 w-fit min-w-20 max-w-full items-center justify-center overflow-hidden rounded-md bg-sunken p-2 sm:max-w-sm',
                            key === 'bannerUrl' && 'w-64',
                        )}>
                            <img src={previewUrl(key)} alt={t('{asset} preview', { asset: assetLabels[key] })} className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                asChild
                                variant="secondary"
                                className={cn(pageCtx.isReadOnly && 'pointer-events-none opacity-50')}
                                aria-disabled={pageCtx.isReadOnly}
                            >
                                <label className="cursor-pointer focus-within:ring-2 focus-within:ring-accent-text">
                                    {t('Upload image')}
                                    <input
                                        className="sr-only"
                                        type="file"
                                        accept="image/png,image/jpeg,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon"
                                        disabled={pageCtx.isReadOnly}
                                        onChange={event => readUpload(key, event.target.files?.[0])}
                                    />
                                </label>
                            </Button>
                            <Button
                                variant="secondary"
                                disabled={pageCtx.isReadOnly || states[key] === ''}
                                onClick={() => dispatch({ configName: key, configValue: '' })}
                            >
                                {t('Use default')}
                            </Button>
                        </div>
                    </div>
                    <SettingItemDesc>
                        {t('PNG, JPEG, GIF, WebP or ICO; maximum 128 KB. SVG uploads are rejected.')}
                        <span className="mt-1 block">{assetRecommendations[key]}</span>
                    </SettingItemDesc>
                </SettingItem>
            ))}

            <SettingGroupHeading
                title={t('Discord status embed')}
                description={t('Customize the public server status message shown by the Discord bot.')}
            />

            <EmbedJsonSetting
                label={t('Status Embed JSON')}
                id={cfg.embedJson.eid}
                value={states.embedJson ?? ''}
                disabled={pageCtx.isReadOnly}
                onChange={cfg.embedJson.state.set}
                onDiscard={cfg.embedJson.state.discard}
                onDefault={cfg.embedJson.state.default}
            />
            <EmbedJsonSetting
                label={t('Status Config JSON')}
                id={cfg.embedConfigJson.eid}
                value={states.embedConfigJson ?? ''}
                disabled={pageCtx.isReadOnly}
                onChange={cfg.embedConfigJson.state.set}
                onDiscard={cfg.embedConfigJson.state.discard}
                onDefault={cfg.embedConfigJson.state.default}
            />
        </SettingsCardShell>
    );
}

function EmbedJsonSetting({ label, id, value, disabled, onChange, onDiscard, onDefault }: {
    label: string;
    id: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
    onDiscard: () => void;
    onDefault: () => void;
}) {
    return <SettingItem label={label} htmlFor={id}>
        <Textarea
            id={id}
            value={attemptBeautifyJsonString(value)}
            onChange={event => onChange(event.target.value)}
            className="min-h-72 font-mono text-xs"
            autoComplete="off"
            disabled={disabled}
            spellCheck={false}
        />
        <SettingItemDesc>
            <TransText k="Use `/status add` in Discord to create or refresh the status embed." />
        </SettingItemDesc>
        <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onDiscard} disabled={disabled}>
                {t('Discard changes')}
            </Button>
            <Button variant="secondary" onClick={onDefault} disabled={disabled}>
                {t('Reset to default')}
            </Button>
        </div>
    </SettingItem>;
}
