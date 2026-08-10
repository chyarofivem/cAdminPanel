import { useEffect, useMemo, useReducer, useRef } from 'react';
import { ImageIcon, PaletteIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingItem, SettingItemDesc } from '../settingsItems';
import SettingsCardShell from '../SettingsCardShell';
import {
    configsReducer,
    getConfigAccessors,
    getConfigDiff,
    getConfigEmptyState,
    getPageConfig,
    type SettingsCardProps,
} from '../utils';
import { useAccent } from '@/hooks/theme';
import { txToast } from '@/components/TxToaster';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { useAuth } from '@/hooks/auth';

const MAX_UPLOAD_BYTES = 128 * 1024;

export const pageConfigs = {
    accent: getPageConfig('general', 'accent'),
    logoUrl: getPageConfig('general', 'logoUrl'),
    faviconUrl: getPageConfig('general', 'faviconUrl'),
    bannerUrl: getPageConfig('general', 'bannerUrl'),
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
    const { accents, setAccent } = useAccent();
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
            <SettingItem label={t('Accent colour')}>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-w-xl">
                    {accents.map(option => (
                        <button
                            key={option.id}
                            type="button"
                            disabled={pageCtx.isReadOnly}
                            onClick={() => dispatch({ configName: 'accent', configValue: option.id })}
                            className={cn(
                                'rounded-md border p-2 text-xs flex flex-col items-center gap-1.5 transition-colors',
                                states.accent === option.id ? 'border-brand-500 ring-2 ring-brand-500/35' : 'hover:bg-muted',
                            )}
                            title={t(option.label)}
                        >
                            <span
                                className="size-7 rounded-full border border-white/20 shadow-sm"
                                style={{ backgroundColor: `rgb(${option.vars['brand-600']})` }}
                            />
                            {t(option.label)}
                        </button>
                    ))}
                </div>
                <SettingItemDesc>
                    <PaletteIcon className="inline size-4 mr-1" /> {t('The preview applies immediately and is saved for web and in-game surfaces.')}
                </SettingItemDesc>
            </SettingItem>

            {(Object.keys(assetLabels) as AssetKey[]).map(key => (
                <SettingItem key={key} label={assetLabels[key]}>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className={cn(
                            'h-20 min-w-20 max-w-sm rounded-md border bg-muted/40 p-2 flex items-center justify-center overflow-hidden',
                            key === 'bannerUrl' && 'w-64',
                        )}>
                            <img src={previewUrl(key)} alt={t('{asset} preview', { asset: assetLabels[key] })} className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button asChild size="xs" variant="muted" disabled={pageCtx.isReadOnly}>
                                <label className="cursor-pointer">
                                    <UploadIcon className="size-4 mr-1.5" /> {t('Upload image')}
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
                                size="xs"
                                variant="outline"
                                disabled={pageCtx.isReadOnly || states[key] === ''}
                                onClick={() => dispatch({ configName: key, configValue: '' })}
                            >
                                <Trash2Icon className="size-4 mr-1.5" /> {t('Use default')}
                            </Button>
                        </div>
                    </div>
                    <SettingItemDesc>
                        <ImageIcon className="inline size-4 mr-1" /> {t('PNG, JPEG, GIF, WebP or ICO; maximum 128 KB. SVG uploads are rejected.')}
                        <span className="mt-1 block text-xs text-zinc-500">{assetRecommendations[key]}</span>
                    </SettingItemDesc>
                </SettingItem>
            ))}
        </SettingsCardShell>
    );
}
