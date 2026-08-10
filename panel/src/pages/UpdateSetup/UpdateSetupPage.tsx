import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Check, ClipboardList, Loader2, Settings2, Sparkles } from 'lucide-react';
import type {
    UpdateSetupCompleteResp,
    UpdateSetupDataResp,
    UpdateSetupField,
} from '@shared/updateSetupApiTypes';
import { useAuth } from '@/hooks/auth';
import { useAuthedFetcher } from '@/hooks/fetch';
import { isValidRedirectPath } from '@/lib/navigation';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const destinationAfterUpdate = () => {
    const redirect = new URLSearchParams(window.location.search).get('r');
    return redirect && isValidRedirectPath(redirect) && !redirect.startsWith('/update-setup')
        ? redirect
        : '/';
};

function UpdateFieldInput({ field, value, onChange }: {
    field: UpdateSetupField;
    value: string;
    onChange: (value: string) => void;
}) {
    return <div className="space-y-2 rounded-xl border border-white/5 bg-black/10 p-4">
        <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`update-field-${field.id}`}>{field.label}</Label>
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">v{field.version}</span>
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">{field.description}</p>
        <Input
            id={`update-field-${field.id}`}
            type={field.type}
            required={field.required && !field.hasStoredValue}
            value={value}
            placeholder={field.hasStoredValue ? t('A value is already stored. Leave blank to keep it.') : field.placeholder}
            onChange={event => onChange(event.target.value)}
            autoComplete={field.type === 'password' ? 'new-password' : 'off'}
        />
    </div>;
}

export default function UpdateSetupPage() {
    const fetcher = useAuthedFetcher();
    const { authData, setAuthData } = useAuth();
    const [values, setValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState<string>();
    const updateSWR = useSWR('/update-setup/data', async url => {
        const response = await fetcher<UpdateSetupDataResp>(url);
        if ('error' in response) throw new Error(response.error);
        return response;
    }, { revalidateOnFocus: false });

    useEffect(() => {
        if (!updateSWR.data) return;
        setValues(Object.fromEntries(updateSWR.data.fields.map(field => [field.id, field.value ?? ''])));
    }, [updateSWR.data]);

    const complete = async () => {
        if (!authData || saving) return;
        setSaving(true);
        setSubmitError(undefined);
        try {
            const response = await fetcher<UpdateSetupCompleteResp>('/update-setup/complete', {
                method: 'POST',
                body: { values },
            });
            if ('error' in response) {
                setSubmitError(response.error);
                return;
            }
            setAuthData({ ...authData, pendingUpdate: false });
            window.history.replaceState(null, '', destinationAfterUpdate());
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : t('Unable to save the update settings.'));
        } finally {
            setSaving(false);
        }
    };

    return <div className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,#18202c_0%,#101319_38%,#090a0d_100%)] px-4 py-8 text-white sm:px-6">
        <main className="mx-auto w-full max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-5 flex items-center justify-between gap-4 px-1">
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-500">{t('Post-update review')}</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('Updated to version {version}', { version: updateSWR.data?.currentVersion ?? window.txConsts.txaVersion })}</h1>
                    {updateSWR.data?.previousVersion && <p className="mt-2 text-sm text-zinc-500">{t('Previously acknowledged version: {version}', { version: updateSWR.data.previousVersion })}</p>}
                </div>
                <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-3 text-brand-400"><Sparkles className="size-6" /></div>
            </div>

            {updateSWR.isLoading && <Card><CardContent className="flex items-center justify-center gap-2 p-14 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />{t('Loading update details...')}</CardContent></Card>}
            {updateSWR.error && <Card className="border-red-500/20 bg-red-500/10"><CardContent className="p-5 text-sm text-red-300">
                <p>{updateSWR.error.message}</p>
                <Button variant="outline" className="mt-4" onClick={() => void updateSWR.mutate()}>{t('Try again')}</Button>
            </CardContent></Card>}

            {updateSWR.data && <div className="space-y-5">
                <Card className="overflow-hidden border-white/10 bg-[#111318]/95">
                    <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
                        <ClipboardList className="size-5 text-brand-500" />
                        <div><h2 className="font-semibold">{t('Changelog')}</h2><p className="text-xs text-zinc-500">{t('Changes since your last acknowledged version.')}</p></div>
                    </div>
                    <CardContent className="space-y-6 p-6">
                        {updateSWR.data.releases.map(release => <section key={release.version}>
                            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-medium text-zinc-100">{release.title}</h3><span className="font-mono text-xs text-brand-400">v{release.version}</span></div>
                            <ul className="space-y-2 text-sm text-zinc-400">{release.changes.map(change => <li key={change} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-400" /><span>{change}</span></li>)}</ul>
                        </section>)}
                    </CardContent>
                </Card>

                <Card className="overflow-hidden border-white/10 bg-[#111318]/95">
                    <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
                        <Settings2 className="size-5 text-brand-500" />
                        <div><h2 className="font-semibold">{t('Required settings')}</h2><p className="text-xs text-zinc-500">{t('Only settings introduced by this update appear here.')}</p></div>
                    </div>
                    <CardContent className="p-6">
                        {updateSWR.data.fields.length ? <div className="space-y-3">{updateSWR.data.fields.map(field => <UpdateFieldInput
                            key={field.id}
                            field={field}
                            value={values[field.id] ?? ''}
                            onChange={value => setValues(current => ({ ...current, [field.id]: value }))}
                        />)}</div> : <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4 text-sm text-emerald-200">
                            {t('No configuration changes are required for this version.')}
                        </div>}
                        {submitError && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{submitError}</p>}
                        <div className="mt-6 flex justify-end"><Button onClick={() => void complete()} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}{t('Save and continue')}
                        </Button></div>
                    </CardContent>
                </Card>
            </div>}
            <footer className="mt-5 text-center text-[11px] leading-5 text-zinc-700">
                <div>Powered by cAdminPanel</div>
            </footer>
        </main>
    </div>;
}
