import { useState } from 'react';
import { ExternalLink, KeyRound, Languages, Link2, Loader2, Palette, Save, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth, useSetAuthData } from '@/hooks/auth';
import { useAccent } from '@/hooks/theme';
import { useBackendApi } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import type { ApiChangePasswordReq, ApiSelfIdentifiersResp, ApiSelfPreferencesReq, ApiSelfPreferencesResp } from '@shared/authApiTypes';
import type { GenericApiResp } from '@shared/genericApiTypes';
import consts from '@shared/consts';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { reloadPanel } from '@/lib/navigation';

export default function UserSettingsPage() {
    const { authData } = useAuth();
    const setAuthData = useSetAuthData();
    const { accent, accents, setAccent } = useAccent();
    const [cfxInput, setCfxInput] = useState(authData ? authData.cfxIdentifier ?? '' : '');
    const [discordInput, setDiscordInput] = useState(() => (authData ? authData.discordIdentifier ?? '' : '').replace(/^discord:/, ''));
    const [isSavingIdentifiers, setIsSavingIdentifiers] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isSavingAccent, setIsSavingAccent] = useState(false);
    const [isSavingLanguage, setIsSavingLanguage] = useState(false);
    const saveIdentifiersApi = useBackendApi<ApiSelfIdentifiersResp>({
        method: 'POST',
        path: '/auth/self/identifiers',
    });
    const changePasswordApi = useBackendApi<GenericApiResp, ApiChangePasswordReq>({
        method: 'POST',
        path: '/auth/changePassword',
    });
    const savePreferencesApi = useBackendApi<ApiSelfPreferencesResp, ApiSelfPreferencesReq>({
        method: 'POST',
        path: '/auth/self/preferences',
    });
    if (!authData) return null;

    const saveIdentifiers = () => {
        setIsSavingIdentifiers(true);
        saveIdentifiersApi({
            data: authData.chyaroLinked
                ? { cfxIdentifier: cfxInput.trim() }
                : { cfxIdentifier: cfxInput.trim(), discordIdentifier: discordInput.trim() },
            toastLoadingMessage: t('Saving your identifiers...'),
            finally: () => setIsSavingIdentifiers(false),
            error: (message, toastId) => txToast.error(message, { id: toastId }),
            success: (data, toastId) => {
                if ('error' in data) return txToast.error(data.error, { id: toastId });
                setAuthData({
                    ...authData,
                    cfxIdentifier: data.cfxIdentifier,
                    discordIdentifier: data.discordIdentifier,
                });
                setCfxInput(data.cfxIdentifier ?? '');
                setDiscordInput((data.discordIdentifier ?? '').replace(/^discord:/, ''));
                txToast.success(t('Identifiers saved.'), { id: toastId });
            },
        });
    };

    const savePassword = () => {
        if (newPassword !== confirmPassword) return txToast.error(t('The new passwords do not match.'));
        if (newPassword.trim() !== newPassword) return txToast.error(t('The password cannot start or end with a space.'));
        if (newPassword.length < consts.adminPasswordMinLength || newPassword.length > consts.adminPasswordMaxLength) {
            return txToast.error(t('Password must be between {min} and {max} characters.', {
                min: consts.adminPasswordMinLength,
                max: consts.adminPasswordMaxLength,
            }));
        }
        setIsSavingPassword(true);
        changePasswordApi({
            data: { oldPassword: currentPassword || undefined, newPassword },
            toastLoadingMessage: t('Saving your local password...'),
            finally: () => setIsSavingPassword(false),
            error: (message, toastId) => txToast.error(message, { id: toastId }),
            success: (data, toastId) => {
                if ('error' in data) return txToast.error(data.error, { id: toastId });
                setAuthData({ ...authData, isTempPassword: false });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                txToast.success(t('Local password saved.'), { id: toastId });
            },
        });
    };

    const selectAccent = (value: string) => {
        if (value === accent || isSavingAccent) return;
        const previousAccent = accent;
        setAccent(value);
        setIsSavingAccent(true);
        savePreferencesApi({
            data: { accent: value },
            toastLoadingMessage: t('Saving accent colour...'),
            finally: () => setIsSavingAccent(false),
            error: (message, toastId) => {
                setAccent(previousAccent);
                txToast.error(message, { id: toastId });
            },
            success: (data, toastId) => {
                if ('error' in data) {
                    setAccent(previousAccent);
                    return txToast.error(data.error, { id: toastId });
                }
                const savedAccent = data.accent ?? value;
                setAccent(savedAccent);
                setAuthData({
                    ...authData,
                    accent: savedAccent,
                    accentColor: data.accentColor,
                });
                txToast.success(t('Accent colour saved to your account.'), { id: toastId });
            },
        });
    };
    const selectLanguage = (value: string) => {
        if (isSavingLanguage) return;
        setIsSavingLanguage(true);
        savePreferencesApi({
            data: { locale: value },
            toastLoadingMessage: t('Saving language...'),
            finally: () => setIsSavingLanguage(false),
            error: message => txToast.error(message),
            success: data => {
                if ('error' in data) return txToast.error(data.error);
                setAuthData({ ...authData, locale: data.locale ?? value });
                reloadPanel();
            },
        });
    };
    const language = authData.locale || window.txConsts.uiLocale;
    const avatar = authData.discordAvatar || authData.profilePicture;

    return <div className="pb-10">
        <PageHeader title={t('User settings')} icon={<Settings2 className="size-6" />} />
        <div className="grid gap-5 xl:grid-cols-2">
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="size-5 text-brand-500" />{t('Appearance')}</CardTitle></CardHeader>
                <CardContent>
                    <Label>{t('Accent colour')}</Label>
                    <p className="mb-4 mt-1 text-sm text-muted-foreground">{t('Choose the colour used for highlights and primary actions on every device signed in to this account.')}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {accents.map(option => <button key={option.id} type="button" disabled={isSavingAccent} onClick={() => selectAccent(option.id)}
                            className={cn('flex flex-col items-center gap-2 rounded-lg border p-3 text-xs transition-colors hover:bg-muted', accent === option.id && 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/25')}
                            aria-pressed={accent === option.id}>
                            <span className="size-8 rounded-full border border-white/20 shadow" style={{ backgroundColor: `rgb(${option.vars['brand-600']})` }} />
                            {t(option.label)}
                        </button>)}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Languages className="size-5 text-brand-500" />{t('Language')}</CardTitle></CardHeader>
                <CardContent>
                    <Label htmlFor="user-language">{t('Panel language')}</Label>
                    <Select value={language} disabled={isSavingLanguage} onValueChange={selectLanguage}>
                        <SelectTrigger id="user-language" className="mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="en">{t('English (default)')}</SelectItem>
                            <SelectItem value="hr">Hrvatski</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="mt-3 text-sm text-muted-foreground">{t('This preference applies to your web panel and in-game menu. It does not change the server-wide language.')}</p>
                </CardContent>
            </Card>

            <Card className="xl:col-span-2">
                <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-5 text-brand-500" />{t('Connected identities')}</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                            <Avatar className="size-12"><AvatarImage src={avatar} /><AvatarFallback>{authData.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                            <div className="min-w-0">
                                <p className="truncate font-medium">{authData.email || authData.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    Discord: {authData.discordIdentifier || t('Not connected')}
                                    {authData.chyaroLinked && <span className="ml-2 text-xs">({t('synced from chyarologin')})</span>}
                                </p>
                            </div>
                        </div>
                        {authData.chyaroLinked && <Button variant="outline" onClick={() => window.open(window.txConsts.chyaroUrl, '_blank', 'noopener,noreferrer')}>
                            <ExternalLink className="mr-2 size-4" />{t('Manage identities')}
                        </Button>}
                    </div>

                    <div className="border-t border-dashed border-white/5 pt-5">
                        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveIdentifiers(); }}>
                            <div>
                                <Label htmlFor="cfx-identifier">{t('cfx.re identifier')}</Label>
                                <p className="mb-3 mt-1 text-sm text-muted-foreground">{t('Enter your cfx.re forum username or an identifier in the fivem:0000 format. Leave it empty to unlink.')}</p>
                                <Input id="cfx-identifier" value={cfxInput} onChange={(e) => setCfxInput(e.target.value)} placeholder="fivem:0000" disabled={isSavingIdentifiers} />
                            </div>
                            {!authData.chyaroLinked ? <div>
                                <Label htmlFor="discord-identifier">{t('Discord user ID')}</Label>
                                <p className="mb-3 mt-1 text-sm text-muted-foreground">{t('Enter the numeric Discord user ID. Leave it empty to unlink.')}</p>
                                <Input id="discord-identifier" inputMode="numeric" value={discordInput} onChange={(e) => setDiscordInput(e.target.value)} placeholder="272800190639898628" disabled={isSavingIdentifiers} />
                            </div> : <div className="rounded-xl border border-white/5 bg-white/[0.025] p-4 text-sm text-zinc-400">
                                {authData.discordIdentifier
                                    ? t('Your verified Discord connection is managed by chyarologin.')
                                    : t('Connect Discord in chyarologin, then sign in with chyarologin again to sync it here.')}
                            </div>}
                            <div className="sm:col-span-2">
                                <Button type="submit" disabled={isSavingIdentifiers || (
                                    cfxInput.trim() === (authData.cfxIdentifier ?? '')
                                    && (authData.chyaroLinked || discordInput.trim() === (authData.discordIdentifier ?? '').replace(/^discord:/, ''))
                                )}>
                                    {isSavingIdentifiers ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                                    {t('Save identifiers')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </CardContent>
            </Card>

            <Card className="xl:col-span-2">
                <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-brand-500" />{t('Local password')}</CardTitle></CardHeader>
                <CardContent>
                    {authData.isTempPassword && <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">{t('You are using a temporary password. Replace it before sharing or bookmarking this account.')}</div>}
                    <p className="mb-5 text-sm text-muted-foreground">{t('A local password lets you sign in with this username even when chyarologin is unavailable. The current password is not required for a temporary password or during a chyarologin-authenticated session.')}</p>
                    <form className="grid gap-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); savePassword(); }}>
                        <div className="space-y-2"><Label htmlFor="current-password">{t('Current password')}</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} disabled={isSavingPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder={t('when required')} /></div>
                        <div className="space-y-2"><Label htmlFor="new-password">{t('New password')}</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={consts.adminPasswordMinLength} maxLength={consts.adminPasswordMaxLength} required value={newPassword} disabled={isSavingPassword} onChange={event => setNewPassword(event.target.value)} /></div>
                        <div className="space-y-2"><Label htmlFor="confirm-password">{t('Confirm new password')}</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={consts.adminPasswordMinLength} maxLength={consts.adminPasswordMaxLength} required value={confirmPassword} disabled={isSavingPassword} onChange={event => setConfirmPassword(event.target.value)} /></div>
                        <div className="md:col-span-3"><Button type="submit" disabled={isSavingPassword || !newPassword || !confirmPassword}>{isSavingPassword ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{t('Save local password')}</Button></div>
                    </form>
                </CardContent>
            </Card>
        </div>
    </div>;
}
