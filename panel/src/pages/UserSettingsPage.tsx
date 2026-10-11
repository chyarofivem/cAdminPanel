import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import Section from '@/components/Section';
import AccentPicker from '@/components/AccentPicker';
import { Alert } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth, useSetAuthData } from '@/hooks/auth';
import { useAccent } from '@/hooks/theme';
import { useBackendApi } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import type { ApiChangePasswordReq, ApiSelfIdentifiersResp, ApiSelfPreferencesReq, ApiSelfPreferencesResp } from '@shared/authApiTypes';
import type { GenericApiResp } from '@shared/genericApiTypes';
import { isCustomAccent, normalizeAccent } from '@shared/accent';
import { normalizeLicenseIdentifier } from '@shared/licenseIdentifier';
import { useAtomValue } from 'jotai';
import { playerlistAtom } from '@/hooks/playerlist';
import consts from '@shared/consts';
import { t } from '@/lib/i18n';
import { reloadPanel } from '@/lib/navigation';

/** While the native colour picker is dragged, save only after this much idle time. */
const ACCENT_SAVE_DELAY_MS = 400;

export default function UserSettingsPage() {
    const { authData } = useAuth();
    const setAuthData = useSetAuthData();
    const { accent, setAccent } = useAccent();
    const [cfxInput, setCfxInput] = useState(authData ? authData.cfxIdentifier ?? '' : '');
    const [discordInput, setDiscordInput] = useState(() => (authData ? authData.discordIdentifier ?? '' : '').replace(/^discord:/, ''));
    const [licenseInput, setLicenseInput] = useState(authData ? authData.licenseIdentifier ?? '' : '');
    //Connected players with a license, so an administrator can join the server and pick themselves.
    const onlinePlayers = useAtomValue(playerlistAtom).filter((player) => player.license);
    const [isSavingIdentifiers, setIsSavingIdentifiers] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
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

    //Accent saving: applied optimistically, saved debounced, rolled back on error.
    //The refs keep the queue consistent across renders and after unmount.
    const savedAccentRef = useRef(accent); //last value the server confirmed
    const pendingAccentRef = useRef<string | null>(null); //value waiting to be saved
    const accentTimerRef = useRef<number | undefined>(undefined);
    const accentInFlightRef = useRef(false);

    const flushAccentSave = () => {
        window.clearTimeout(accentTimerRef.current);
        accentTimerRef.current = undefined;
        const value = pendingAccentRef.current;
        if (value === null || accentInFlightRef.current) return;
        pendingAccentRef.current = null;
        if (value === savedAccentRef.current) return;

        const rollback = () => {
            pendingAccentRef.current = null;
            setAccent(savedAccentRef.current);
        };
        accentInFlightRef.current = true;
        savePreferencesApi({
            data: { accent: value },
            toastLoadingMessage: t('Saving accent colour...'),
            finally: () => {
                accentInFlightRef.current = false;
                if (pendingAccentRef.current !== null) flushAccentSave();
            },
            error: (message, toastId) => {
                rollback();
                txToast.error(message, { id: toastId });
            },
            success: (data, toastId) => {
                if ('error' in data) {
                    rollback();
                    return txToast.error(data.error, { id: toastId });
                }
                const savedAccent = normalizeAccent(data.accent ?? value);
                savedAccentRef.current = savedAccent;
                if (pendingAccentRef.current === null) setAccent(savedAccent);
                setAuthData((prev) => prev ? {
                    ...prev,
                    accent: savedAccent,
                    accentColor: data.accentColor,
                } : prev);
                txToast.success(t('Accent colour saved to your account.'), { id: toastId });
            },
        });
    };

    //Saves a pending change when leaving the page, so the applied accent is never left unsaved
    const flushAccentSaveRef = useRef(flushAccentSave);
    flushAccentSaveRef.current = flushAccentSave;
    useEffect(() => () => {
        if (accentTimerRef.current !== undefined) flushAccentSaveRef.current();
    }, []);

    if (!authData) return null;

    const saveIdentifiers = () => {
        setIsSavingIdentifiers(true);
        saveIdentifiersApi({
            data: {
                cfxIdentifier: cfxInput.trim(),
                discordIdentifier: discordInput.trim(),
                licenseIdentifier: licenseInput.trim(),
            },
            toastLoadingMessage: t('Saving your identifiers...'),
            finally: () => setIsSavingIdentifiers(false),
            error: (message, toastId) => txToast.error(message, { id: toastId }),
            success: (data, toastId) => {
                if ('error' in data) return txToast.error(data.error, { id: toastId });
                setAuthData({
                    ...authData,
                    cfxIdentifier: data.cfxIdentifier,
                    discordIdentifier: data.discordIdentifier,
                    licenseIdentifier: data.licenseIdentifier,
                });
                setCfxInput(data.cfxIdentifier ?? '');
                setDiscordInput((data.discordIdentifier ?? '').replace(/^discord:/, ''));
                setLicenseInput(data.licenseIdentifier ?? '');
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
        const next = normalizeAccent(value);
        if (next === accent) return;
        setAccent(next);
        pendingAccentRef.current = next;
        window.clearTimeout(accentTimerRef.current);
        if (isCustomAccent(next)) {
            accentTimerRef.current = window.setTimeout(flushAccentSave, ACCENT_SAVE_DELAY_MS);
        } else {
            flushAccentSave();
        }
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
    const avatar = authData.profilePicture;
    const hasIdentifierChanges = !(
        cfxInput.trim() === (authData.cfxIdentifier ?? '')
        && discordInput.trim() === (authData.discordIdentifier ?? '').replace(/^discord:/, '')
        && licenseInput.trim() === (authData.licenseIdentifier ?? '')
    );
    const hasGameIdentifier = Boolean(authData.cfxIdentifier || authData.discordIdentifier || authData.licenseIdentifier);
    const licenseInputIsInvalid = licenseInput.trim().length > 0 && !normalizeLicenseIdentifier(licenseInput);

    return <div className="pb-10">
        <PageHeader title={t('User settings')} />
        <div className="flex flex-col gap-6">
            <Section title={t('Appearance')}>
                <div className="flex max-w-md flex-col gap-2">
                    <Label htmlFor="user-accent">{t('Accent colour')}</Label>
                    <AccentPicker id="user-accent" value={accent} onChange={selectAccent} />
                    <p className="text-dense text-muted-foreground">{t('Choose the colour used for highlights and primary actions on every device signed in to this account.')}</p>
                </div>
            </Section>

            <Section title={t('Language')}>
                <div className="flex max-w-md flex-col gap-2">
                    <Label htmlFor="user-language">{t('Panel language')}</Label>
                    <Select value={language} disabled={isSavingLanguage} onValueChange={selectLanguage}>
                        <SelectTrigger id="user-language"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="en">{t('English (default)')}</SelectItem>
                            <SelectItem value="hr">Hrvatski</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-dense text-muted-foreground">{t('This preference applies to your web panel and in-game menu. It does not change the server-wide language.')}</p>
                </div>
            </Section>

            <Section title={t('Connected identities')}>
                <div className="flex flex-col gap-6">
                    {!hasGameIdentifier && <Alert variant="warning">
                        {t('This account has no game identifier, so the in-game menu will not open for you. Link your Rockstar license below, then rejoin the server. Accounts created with the console PIN start without one.')}
                    </Alert>}
                    <div className="flex min-w-0 items-center gap-4">
                        <Avatar className="size-12"><AvatarImage src={avatar} /><AvatarFallback>{authData.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                            <p className="truncate font-medium text-white">{authData.name}</p>
                            <p className="truncate text-dense text-muted-foreground">
                                Discord: {authData.discordIdentifier || t('Not connected')}
                            </p>
                            <p className="truncate text-dense text-muted-foreground">
                                {t('Rockstar license')}: {authData.licenseIdentifier ? t('Linked') : t('Not connected')}
                            </p>
                        </div>
                    </div>

                    <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); saveIdentifiers(); }}>
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="flex min-w-0 flex-col gap-2">
                                <Label htmlFor="cfx-identifier">{t('cfx.re identifier')}</Label>
                                <Input id="cfx-identifier" value={cfxInput} onChange={(e) => setCfxInput(e.target.value)} placeholder="fivem:0000" disabled={isSavingIdentifiers} />
                                <p className="text-dense text-muted-foreground">{t('Enter your cfx.re forum username or an identifier in the fivem:0000 format. Leave it empty to unlink.')}</p>
                            </div>
                            <div className="flex min-w-0 flex-col gap-2">
                                <Label htmlFor="discord-identifier">{t('Discord user ID')}</Label>
                                <Input id="discord-identifier" inputMode="numeric" value={discordInput} onChange={(e) => setDiscordInput(e.target.value)} placeholder="272800190639898628" disabled={isSavingIdentifiers} />
                                <p className="text-dense text-muted-foreground">{t('Enter the numeric Discord user ID. Leave it empty to unlink.')}</p>
                            </div>
                            <div className="flex min-w-0 flex-col gap-2 md:col-span-2">
                                <Label htmlFor="license-identifier">{t('Rockstar license')}</Label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Input
                                        id="license-identifier"
                                        className="font-mono sm:flex-1"
                                        value={licenseInput}
                                        onChange={(e) => setLicenseInput(e.target.value)}
                                        placeholder="license:0000000000000000000000000000000000000000"
                                        spellCheck={false}
                                        autoComplete="off"
                                        aria-invalid={licenseInputIsInvalid}
                                        aria-describedby="license-identifier-help"
                                        disabled={isSavingIdentifiers}
                                    />
                                    {onlinePlayers.length > 0 && <Select
                                        disabled={isSavingIdentifiers}
                                        onValueChange={(license) => setLicenseInput(normalizeLicenseIdentifier(license) ?? license)}
                                    >
                                        <SelectTrigger className="sm:w-64" aria-label={t('Pick yourself from the connected players')}>
                                            <SelectValue placeholder={t('Pick a connected player')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {onlinePlayers.map((player) => (
                                                <SelectItem key={player.netid} value={player.license!}>
                                                    #{player.netid} {player.displayName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>}
                                </div>
                                {licenseInputIsInvalid
                                    ? <p id="license-identifier-help" className="text-dense text-danger-text">{t('Enter license: followed by 40 letters and digits.')}</p>
                                    : <p id="license-identifier-help" className="text-dense text-muted-foreground">{t('The in-game menu recognises you by this license. Join the server and pick yourself from the connected players, or paste it from your player page. Leave it empty to unlink.')}</p>}
                            </div>
                        </div>
                        <div>
                            <Button type="submit" disabled={isSavingIdentifiers || !hasIdentifierChanges || licenseInputIsInvalid}>
                                {isSavingIdentifiers ? t('Saving...') : t('Save identifiers')}
                            </Button>
                        </div>
                    </form>
                </div>
            </Section>

            <Section
                title={t('Local password')}
                description={t('Your username and this password are how you sign in to the panel. The current password is not required while you are using a temporary one.')}
            >
                <div className="flex flex-col gap-6">
                    {authData.isTempPassword && <Alert variant="warning">
                        {t('You are using a temporary password. Replace it before sharing or bookmarking this account.')}
                    </Alert>}
                    <form className="flex flex-col gap-6" onSubmit={(event) => { event.preventDefault(); savePassword(); }}>
                        <div className="grid gap-6 md:grid-cols-3">
                            <div className="flex min-w-0 flex-col gap-2">
                                <Label htmlFor="current-password">{t('Current password')}</Label>
                                <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} disabled={isSavingPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder={t('when required')} />
                            </div>
                            <div className="flex min-w-0 flex-col gap-2">
                                <Label htmlFor="new-password">{t('New password')}</Label>
                                <Input id="new-password" type="password" autoComplete="new-password" minLength={consts.adminPasswordMinLength} maxLength={consts.adminPasswordMaxLength} required value={newPassword} disabled={isSavingPassword} onChange={event => setNewPassword(event.target.value)} />
                            </div>
                            <div className="flex min-w-0 flex-col gap-2">
                                <Label htmlFor="confirm-password">{t('Confirm new password')}</Label>
                                <Input id="confirm-password" type="password" autoComplete="new-password" minLength={consts.adminPasswordMinLength} maxLength={consts.adminPasswordMaxLength} required value={confirmPassword} disabled={isSavingPassword} onChange={event => setConfirmPassword(event.target.value)} />
                            </div>
                        </div>
                        <div>
                            <Button type="submit" disabled={isSavingPassword || !newPassword || !confirmPassword}>
                                {isSavingPassword ? t('Saving...') : t('Save local password')}
                            </Button>
                        </div>
                    </form>
                </div>
            </Section>
        </div>
    </div>;
}
