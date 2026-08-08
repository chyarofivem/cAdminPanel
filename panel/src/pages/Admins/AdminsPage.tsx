import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useAuthedFetcher } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import {
    cadminApiPath,
    cadminData,
    toCadminLicenseIdentifier,
    type CadminPlayer,
    type CadminResponse,
} from '@/pages/CAdmin/api';
import { t } from '@/lib/i18n';

type StaffMember = {
    name: string;
    master: boolean;
    isSelf: boolean;
    disableEdit: boolean;
    disableDelete: boolean;
    email: string;
    citizenfxId: string;
    citizenfxIdentifier: string;
    discordId: string;
    permissions: string[];
};

type Permission = {
    id: string;
    label: string;
    dangerous: boolean;
    section: 'Panel & Server' | 'Character Management' | 'In-game Menu';
};

type StaffData = { admins: StaffMember[]; permissions: Permission[] };
type StaffDataResponse = { success: true; data: StaffData } | { success: false; error: string };
type ActionResponse = { type: 'success' | 'danger'; message?: string; refresh?: boolean };
type StaffDraft = {
    name: string;
    email: string;
    citizenfxID: string;
    discordID: string;
    permissions: string[];
};

const emptyDraft: StaffDraft = { name: '', email: '', citizenfxID: '', discordID: '', permissions: [] };
const sectionOrder: Permission['section'][] = ['Panel & Server', 'Character Management', 'In-game Menu'];

const permissionSummary = (member: StaffMember) => {
    if (member.master) return t('Master account');
    if (member.permissions.includes('all_permissions')) return t('All permissions');
    return t(member.permissions.length === 1 ? '{count} permission' : '{count} permissions', { count: member.permissions.length });
};

export default function AdminsPage() {
    const fetcher = useAuthedFetcher();
    const openConfirmDialog = useOpenConfirmDialog();
    const swr = useSWR('/adminManager/data', async (url) => {
        const response = await fetcher<StaffDataResponse>(url);
        if (!response.success) throw new Error(response.error);
        return response.data;
    });
    const [editing, setEditing] = useState<StaffMember | 'new' | null>(null);
    const [draft, setDraft] = useState<StaffDraft>(emptyDraft);
    const [saving, setSaving] = useState(false);

    const groupedPermissions = useMemo(() => sectionOrder.map(section => ({
        section,
        permissions: (swr.data?.permissions ?? []).filter(permission => permission.section === section),
    })), [swr.data?.permissions]);

    const openNew = (prefill: Partial<StaffDraft> = {}) => {
        setDraft({ ...emptyDraft, ...prefill });
        setEditing('new');
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('autofill')) return;
        const rawName = params.get('name') || '';
        const safeName = rawName
            .replace(/[^a-zA-Z0-9_.-]+/g, '_')
            .replace(/[_-]{2,}/g, '_')
            .replace(/^[-_.]+|[-_.]+$/g, '')
            .slice(0, 20);
        const discord = params.get('discord') || '';
        const prefill: StaffDraft = {
            ...emptyDraft,
            name: safeName,
            email: params.get('email') || '',
            citizenfxID: params.get('citizenfx') || '',
            discordID: discord.includes(':') ? discord.split(':').pop() || '' : discord,
        };
        openNew(prefill);
        const license = params.get('license');
        window.history.replaceState({}, '', window.location.pathname);

        if (!prefill.email && license && window.txConsts.cadminEnabled) {
            const cadminIdentifier = toCadminLicenseIdentifier(license);
            if (!cadminIdentifier) return;
            const url = `${cadminApiPath(`player/${encodeURIComponent(cadminIdentifier)}`)}?scope=player`;
            void fetcher<CadminResponse<CadminPlayer[]>>(url)
                .then(cadminData)
                .then(players => {
                    const email = players.find(player => player.account?.email)?.account?.email;
                    if (!email) return;
                    setDraft(current => current.name === prefill.name ? { ...current, email } : current);
                })
                .catch(() => undefined);
        }
    }, []);
    const openEdit = (member: StaffMember) => {
        setDraft({
            name: member.name,
            email: member.email,
            citizenfxID: member.citizenfxId,
            discordID: member.discordId,
            permissions: member.permissions,
        });
        setEditing(member);
    };
    const togglePermission = (id: string, enabled: boolean) => setDraft(current => ({
        ...current,
        permissions: enabled
            ? (id === 'all_permissions' ? ['all_permissions'] : [...current.permissions.filter(item => item !== 'all_permissions'), id])
            : current.permissions.filter(item => item !== id),
    }));
    const save = async () => {
        if (!draft.name.trim()) return txToast.error(t('Enter a username.'));
        if (!draft.email.trim()) return txToast.error(t('Enter the verified chyarologin email used by this staff member.'));
        setSaving(true);
        try {
            const action = editing === 'new' ? 'add' : 'edit';
            const response = await fetcher<ActionResponse>(`/adminManager/${action}`, {
                method: 'POST',
                body: {
                    name: draft.name.trim(),
                    chyaroEmail: draft.email.trim(),
                    citizenfxID: draft.citizenfxID.trim(),
                    discordID: draft.discordID.trim(),
                    permissions: draft.permissions,
                },
            });
            if (response.type !== 'success') throw new Error(response.message || t('Unable to save this staff member.'));
            txToast.success(t(editing === 'new' ? 'Staff member added.' : 'Staff permissions updated.'));
            setEditing(null);
            await swr.mutate();
        } catch (error) {
            txToast.error(error instanceof Error ? t(error.message) : t('Unable to save this staff member.'));
        } finally { setSaving(false); }
    };
    const performRemove = async (member: StaffMember) => {
        try {
            const response = await fetcher<ActionResponse>('/adminManager/delete', { method: 'POST', body: { name: member.name } });
            if (response.type !== 'success') throw new Error(response.message || t('Unable to remove this staff member.'));
            txToast.success(t('{name} removed.', { name: member.name }));
            await swr.mutate();
        } catch (error) { txToast.error(error instanceof Error ? t(error.message) : t('Unable to remove this staff member.')); }
    };
    const remove = (member: StaffMember) => openConfirmDialog({
        title: t('Remove {name}?', { name: member.name }),
        message: t('This removes their local txAdmin access. Their chyarologin account is not deleted.'),
        actionLabel: t('Remove access'),
        onConfirm: () => { void performRemove(member); },
    });

    return <div>
        <PageHeader title={t('Staff & Permissions')} icon={<ShieldCheck className="size-6" />} />
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <p className="max-w-3xl text-sm text-zinc-400">{t("Access is stored locally in txAdmin's admins.json. chyarologin supplies the verified email and profile identity only; it never grants a permission.")}</p>
                {swr.data && <p className="mt-1 text-xs text-zinc-600">{t(swr.data.admins.length === 1 ? '{count} local staff account' : '{count} local staff accounts', { count: swr.data.admins.length })}</p>}
            </div>
            <Button onClick={() => openNew()}><Plus className="mr-2 size-4" />{t('Add staff member')}</Button>
        </div>

        {swr.error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{swr.error.message}</div>}
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-dashed border-white/5 text-xs uppercase tracking-widest text-zinc-500">
                            <tr><th className="px-6 py-3 text-left font-medium">{t('Staff member')}</th><th className="px-6 py-3 text-left font-medium">{t('Login identity')}</th><th className="px-6 py-3 text-left font-medium">{t('Local access')}</th><th className="px-6 py-3" /></tr>
                        </thead>
                        <tbody className="divide-y divide-dashed divide-white/5">
                            {swr.data?.admins.map(member => <tr key={member.name} className="transition hover:bg-white/[0.03]">
                                <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-brand-500/10 text-brand-400"><UserRound className="size-4" /></span><div><p className="font-medium text-white">{member.name}{member.isSelf && <span className="ml-2 text-xs text-brand-400">{t('you')}</span>}</p><p className="text-xs text-zinc-600">{member.master ? t('Owner') : t('Staff')}</p></div></div></td>
                                <td className="px-6 py-4"><p className="text-zinc-300">{member.email || t('No email bound')}</p><p className="mt-0.5 font-mono text-xs text-zinc-600">{member.citizenfxIdentifier || (member.discordId ? `discord:${member.discordId}` : t('No game identifier'))}</p></td>
                                <td className="px-6 py-4"><span className={cn('rounded-md px-2 py-1 text-xs', member.master || member.permissions.includes('all_permissions') ? 'bg-amber-500/10 text-amber-300' : 'bg-white/5 text-zinc-400')}>{permissionSummary(member)}</span></td>
                                <td className="px-6 py-4"><div className="flex justify-end gap-2">{!member.isSelf && <Button size="sm" variant="outline" disabled={member.disableEdit} onClick={() => openEdit(member)}><Pencil className="mr-1 size-3.5" />{t('Edit')}</Button>}<Button size="sm" variant="destructive" disabled={member.disableDelete} onClick={() => remove(member)}><Trash2 className="size-3.5" /></Button></div></td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
                {swr.isLoading && <p className="px-6 py-12 text-center text-sm text-zinc-500">{t('Loading local staff…')}</p>}
            </CardContent>
        </Card>

        <Dialog open={editing !== null} onOpenChange={open => !open && setEditing(null)}>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-white/10 bg-[#17191e]">
                <DialogHeader><DialogTitle>{editing === 'new' ? t('Add local staff member') : t('Edit {name}', { name: draft.name })}</DialogTitle><DialogDescription>{t('Identity determines who signs in. The checkboxes below are the only source of authorization.')}</DialogDescription></DialogHeader>
                <div className="grid gap-6 py-2">
                    <section className="rounded-2xl border border-white/5 bg-white/[0.025] p-5">
                        <h3 className="mb-4 flex items-center text-sm font-semibold text-white"><UserRound className="mr-2 size-4 text-brand-400" />{t('Identity')}</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2"><Label htmlFor="staff-name">{t('Username')}</Label><Input id="staff-name" value={draft.name} readOnly={editing !== 'new'} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder={t('panel username')} /></div>
                            <div className="space-y-2"><Label htmlFor="staff-email">{t('chyarologin email')}</Label><Input id="staff-email" type="email" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} placeholder="verified@example.com" /><p className="text-xs text-zinc-600">{t('Used only to match the verified login to this local account.')}</p></div>
                            <div className="space-y-2"><Label htmlFor="staff-fivem">{t('Cfx.re username or fivem ID')}</Label><Input id="staff-fivem" value={draft.citizenfxID} onChange={event => setDraft({ ...draft, citizenfxID: event.target.value })} placeholder={t('optional')} /></div>
                            <div className="space-y-2"><Label htmlFor="staff-discord">{t('Discord user ID')}</Label><Input id="staff-discord" value={draft.discordID} onChange={event => setDraft({ ...draft, discordID: event.target.value })} placeholder={t('optional')} /></div>
                        </div>
                    </section>
                    <section className="rounded-2xl border border-white/5 bg-white/[0.025] p-5">
                        <h3 className="mb-1 flex items-center text-sm font-semibold text-white"><KeyRound className="mr-2 size-4 text-brand-400" />{t('Local txAdmin permissions')}</h3>
                        <p className="mb-5 text-xs text-zinc-600">{t('Dangerous permissions are highlighted. Staff cannot grant permissions they do not already have.')}</p>
                        <p className="mb-5 -mt-3 text-xs text-zinc-500">{t('All Permissions grants every listed permission. Linked Accounts and CFG Editor are master-only and are not permissions.')}</p>
                        <div className="grid gap-6 lg:grid-cols-3">{groupedPermissions.map(group => <div key={group.section}><h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">{t(group.section)}</h4><div className="space-y-2.5">{group.permissions.map(permission => <label key={permission.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition hover:bg-white/5"><Checkbox checked={draft.permissions.includes(permission.id)} onCheckedChange={value => togglePermission(permission.id, value === true)} /><span><span className={cn('block text-sm', permission.dangerous ? 'text-red-300' : 'text-zinc-300')}>{t(permission.label)}</span><span className="font-mono text-[10px] text-zinc-600">{permission.id}</span></span></label>)}</div></div>)}</div>
                    </section>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>{t('Cancel')}</Button><Button disabled={saving} onClick={save}>{saving ? t('Saving…') : t('Save local access')}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </div>;
}
