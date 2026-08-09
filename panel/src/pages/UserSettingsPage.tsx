import { ExternalLink, Languages, Link2, Palette, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/auth';
import { useAccent } from '@/hooks/theme';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

const ACCENT_STORAGE_KEY = 'panel:user-accent';
const LANGUAGE_STORAGE_KEY = 'panel:user-language';

export default function UserSettingsPage() {
    const { authData } = useAuth();
    const { accent, accents, setAccent } = useAccent();
    if (!authData) return null;

    const selectAccent = (value: string) => {
        localStorage.setItem(ACCENT_STORAGE_KEY, value);
        setAccent(value);
    };
    const selectLanguage = (value: string) => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
        document.cookie = `panelLocale=${encodeURIComponent(value)};path=/;SameSite=Lax;max-age=31536000`;
        window.location.reload();
    };
    const language = localStorage.getItem(LANGUAGE_STORAGE_KEY) || window.txConsts.uiLocale;
    const avatar = authData.discordAvatar || authData.profilePicture;

    return <div className="pb-10">
        <PageHeader title={t('User settings')} icon={<Settings2 className="size-6" />} />
        <div className="grid gap-5 xl:grid-cols-2">
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="size-5 text-brand-500" />{t('Appearance')}</CardTitle></CardHeader>
                <CardContent>
                    <Label>{t('Accent colour')}</Label>
                    <p className="mb-4 mt-1 text-sm text-muted-foreground">{t('Choose the colour used for highlights and primary actions on this device.')}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {accents.map(option => <button key={option.id} type="button" onClick={() => selectAccent(option.id)}
                            className={cn('flex flex-col items-center gap-2 rounded-lg border p-3 text-xs transition-colors hover:bg-muted', accent === option.id && 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/25')}
                            aria-pressed={accent === option.id}>
                            <span className="size-8 rounded-full border border-white/20 shadow" style={{ backgroundColor: `oklch(${option.vars['brand-600']})` }} />
                            {t(option.label)}
                        </button>)}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Languages className="size-5 text-brand-500" />{t('Language')}</CardTitle></CardHeader>
                <CardContent>
                    <Label htmlFor="user-language">{t('Panel language')}</Label>
                    <Select value={language} onValueChange={selectLanguage}>
                        <SelectTrigger id="user-language" className="mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="en">{t('English (default)')}</SelectItem>
                            <SelectItem value="hr">Hrvatski</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="mt-3 text-sm text-muted-foreground">{t('This preference applies only to your browser and does not change the server language.')}</p>
                </CardContent>
            </Card>

            <Card className="xl:col-span-2">
                <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-5 text-brand-500" />{t('Connected identities')}</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                        <Avatar className="size-12"><AvatarImage src={avatar} /><AvatarFallback>{authData.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                            <p className="truncate font-medium">{authData.email || authData.name}</p>
                            <p className="text-sm text-muted-foreground">cfx.re: {authData.cfxIdentifier || t('Not connected')}</p>
                            <p className="text-sm text-muted-foreground">Discord: {authData.discordIdentifier || t('Not connected')}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => window.open(window.txConsts.chyaroUrl, '_blank', 'noopener,noreferrer')}>
                        <ExternalLink className="mr-2 size-4" />{t('Manage identities')}
                    </Button>
                </CardContent>
            </Card>
        </div>
    </div>;
}
