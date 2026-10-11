import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { CopyIcon } from 'lucide-react';
import { useAuthedFetcher } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import { ListRow, ListRows } from '@/components/ListRow';
import CopyRow from '@/components/CopyRow';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/page-header';
import { cn, copyToClipboard } from '@/lib/utils';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { t } from '@/lib/i18n';
import { normalizeLicenseIdentifier } from '@shared/licenseIdentifier';

type StaffMember = {
    name: string;
    master: boolean;
    isSelf: boolean;
    disableEdit: boolean;
    disableDelete: boolean;
    citizenfxId: string;
    citizenfxIdentifier: string;
    discordId: string;
    /** Rockstar license as `license:<hex>`, or an empty string. */
    licenseIdentifier: string;
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
type ActionResponse = { type: 'success' | 'danger'; message?: string; refresh?: boolean; temporaryPassword?: string };
type StaffDraft = {
    name: string;
    citizenfxID: string;
    discordID: string;
    licenseID: string;
    permissions: string[];
};

const emptyDraft: StaffDraft = { name: '', citizenfxID: '', discordID: '', licenseID: '', permissions: [] };
const sectionOrder: Permission['section'][] = ['Panel & Server', 'Character Management', 'In-game Menu'];

const permissionSummary = (member: StaffMember) => {
    if (member.master) return t('Master account');
    if (member.permissions.includes('all_permissions')) return t('All permissions');
    return t(member.permissions.length === 1 ? '{count} permission' : '{count} permissions', { count: member.permissions.length });
};

/** Icon-only copy button for an identifier shown in a row. */
function CopyIdButton({ value }: { value: string }) {
    const surrogateRef = useRef<HTMLDivElement>(null);
    const handleCopy = async () => {
        if (!surrogateRef.current) return;
        try {
            const result = await copyToClipboard(value, surrogateRef.current);
            if (result === false) throw new Error('copy failed');
            txToast.success(t('Copied to clipboard.'));
        } catch (error) {
            txToast.error(t('Could not copy to the clipboard.'));
        }
    };
    return <div ref={surrogateRef} className="shrink-0">
        <IconButton label={t('Copy identifier')} icon={<CopyIcon />} onClick={() => void handleCopy()} />
    </div>;
}

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
    const [temporaryCredentials, setTemporaryCredentials] = useState<{ username: string; password: string } | null>(null);

    const groupedPermissions = useMemo(() => sectionOrder.map(section => ({
        section,
        permissions: (swr.data?.permissions ?? []).filter(permission => permission.section === section),
    })), [swr.data?.permissions]);

    //An account with neither identifier is reachable only through the panel: the
    //in-game menu authenticates on the identifiers the game reports and nothing else.
    const hasGameIdentity = draft.citizenfxID.trim().length > 0
        || draft.discordID.trim().length > 0
        || draft.licenseID.trim().length > 0;
    const licenseIsInvalid = draft.licenseID.trim().length > 0 && !normalizeLicenseIdentifier(draft.licenseID);

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
            citizenfxID: params.get('citizenfx') || '',
            discordID: discord.includes(':') ? discord.split(':').pop() || '' : discord,
            licenseID: normalizeLicenseIdentifier(params.get('license')) ?? '',
        };
        openNew(prefill);
        window.history.replaceState({}, '', window.location.pathname);
    }, []);
    const openEdit = (member: StaffMember) => {
        setDraft({
            name: member.name,
            citizenfxID: member.citizenfxId,
            discordID: member.discordId,
            licenseID: member.licenseIdentifier,
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
        if (licenseIsInvalid) return txToast.error(t('Enter license: followed by 40 letters and digits.'));
        setSaving(true);
        try {
            const action = editing === 'new' ? 'add' : 'edit';
            const response = await fetcher<ActionResponse>(`/adminManager/${action}`, {
                method: 'POST',
                body: {
                    name: draft.name.trim(),
                    citizenfxID: draft.citizenfxID.trim(),
                    discordID: draft.discordID.trim(),
                    licenseID: draft.licenseID.trim(),
                    permissions: draft.permissions,
                },
            });
            if (response.type !== 'success') throw new Error(response.message || t('Unable to save this staff member.'));
            if (editing === 'new' && response.temporaryPassword) {
                setTemporaryCredentials({ username: draft.name.trim(), password: response.temporaryPassword });
            }
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
        message: t('This removes their local panel access. Their game identifiers are left untouched.'),
        actionLabel: t('Remove access'),
        onConfirm: () => { void performRemove(member); },
    });

    return <div className="pb-8">
        <PageHeader
            title={t('Staff & Permissions')}
            subtitle={t("Access is stored locally in the panel's admins.json. Staff sign in with a local username and password, or use linked game identifiers in-menu.")}
        >
            <Button onClick={() => openNew()}>{t('Add staff member')}</Button>
        </PageHeader>

        <div className="flex flex-col gap-6">
            {swr.error && <Alert variant="destructive"><AlertDescription>{swr.error.message}</AlertDescription></Alert>}
            {swr.isLoading && <p role="status" className="text-sm text-muted-foreground">{t('Loading local staff…')}</p>}
            {swr.data && <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold tabular-nums text-white">
                    {t(swr.data.admins.length === 1 ? '{count} local staff account' : '{count} local staff accounts', { count: swr.data.admins.length })}
                </h2>
                <ListRows>
                    {swr.data.admins.map(member => {
                        const gameIdentifier = member.licenseIdentifier
                            || member.citizenfxIdentifier
                            || (member.discordId ? `discord:${member.discordId}` : '');
                        const hasFullAccess = member.master || member.permissions.includes('all_permissions');
                        return <ListRow key={member.name} className="flex-col items-stretch sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm font-medium text-white">{member.name}</span>
                                    {member.isSelf && <Badge>{t('you')}</Badge>}
                                    <span className="text-dense text-muted-foreground">{member.master ? t('Owner') : t('Staff')}</span>
                                </div>
                                {gameIdentifier
                                    ? <div className="flex min-w-0 items-center gap-1">
                                        <code className="min-w-0 break-all font-mono text-xs text-muted-foreground">{gameIdentifier}</code>
                                        <CopyIdButton value={gameIdentifier} />
                                    </div>
                                    : <Badge variant="warning" className="mt-2">{t('No game identifier')}</Badge>}
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <Badge variant={hasFullAccess ? 'warning' : 'default'}>{permissionSummary(member)}</Badge>
                                {!member.isSelf && <Button size="sm" variant="secondary" disabled={member.disableEdit} onClick={() => openEdit(member)}>{t('Edit')}</Button>}
                                <Button size="sm" variant="outline-destructive" disabled={member.disableDelete} onClick={() => remove(member)}>{t('Remove')}</Button>
                            </div>
                        </ListRow>;
                    })}
                </ListRows>
            </section>}
        </div>

        <Dialog open={editing !== null} onOpenChange={open => !open && setEditing(null)}>
            <DialogContent className="max-h-[90vh] max-w-4xl">
                <DialogHeader><DialogTitle>{editing === 'new' ? t('Add local staff member') : t('Edit {name}', { name: draft.name })}</DialogTitle><DialogDescription>{t('Identity determines who signs in. The checkboxes below are the only source of authorization.')}</DialogDescription></DialogHeader>
                <section className="flex flex-col gap-4">
                    <h3 className="text-base font-semibold text-white">{t('Identity')}</h3>
                    {editing === 'new' && <Alert><AlertDescription>{t('A temporary local password will be generated and shown once after saving. The staff member must change it on first login.')}</AlertDescription></Alert>}
                    {!hasGameIdentity && <Alert variant="warning"><AlertDescription>{t('Fill in at least one identifier below, or this account can only sign in to the panel. The in-game menu recognises staff by identifier alone, so it never opens for an account without one.')}</AlertDescription></Alert>}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex flex-col gap-2"><Label htmlFor="staff-name">{t('Username')}</Label><Input id="staff-name" value={draft.name} readOnly={editing !== 'new'} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder={t('panel username')} /></div>
                        <div className="flex flex-col gap-2"><Label htmlFor="staff-fivem">{t('Cfx.re username or fivem ID')}</Label><Input id="staff-fivem" value={draft.citizenfxID} onChange={event => setDraft({ ...draft, citizenfxID: event.target.value })} placeholder={t('optional')} /><p className="text-dense text-muted-foreground">{t('The identifier the game reports, so this is what matches staff in game.')}</p></div>
                        <div className="flex flex-col gap-2"><Label htmlFor="staff-discord">{t('Discord user ID')}</Label><Input id="staff-discord" value={draft.discordID} onChange={event => setDraft({ ...draft, discordID: event.target.value })} placeholder={t('optional')} /><p className="text-dense text-muted-foreground">{t('Also matches in game, and links the account to the Discord bot.')}</p></div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="staff-license">{t('Rockstar license')}</Label>
                            <Input
                                id="staff-license"
                                className="font-mono"
                                value={draft.licenseID}
                                onChange={event => setDraft({ ...draft, licenseID: event.target.value })}
                                placeholder="license:…"
                                spellCheck={false}
                                autoComplete="off"
                                aria-invalid={licenseIsInvalid}
                            />
                            {licenseIsInvalid
                                ? <p className="text-dense text-danger-text">{t('Enter license: followed by 40 letters and digits.')}</p>
                                : <p className="text-dense text-muted-foreground">{t('Every FiveM and RedM player has one, so it is the most reliable way to match staff in game.')}</p>}
                        </div>
                    </div>
                </section>
                <section className="flex flex-col gap-4">
                    <div>
                        <h3 className="text-base font-semibold text-white">{t('Local panel permissions')}</h3>
                        <p className="mt-1 text-dense text-muted-foreground">{t('Dangerous permissions are highlighted. Staff cannot grant permissions they do not already have.')}</p>
                        <p className="mt-1 text-dense text-muted-foreground">{t('All Permissions grants every listed permission. The CFG Editor is master-only and is not a permission.')}</p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">{groupedPermissions.map(group => <div key={group.section} className="flex flex-col gap-2">
                        <h4 className="text-dense font-medium text-muted-foreground">{t(group.section)}</h4>
                        <div className="flex flex-col gap-1">{group.permissions.map(permission => <label key={permission.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-sm p-2 transition-colors duration-150 hover:bg-raise">
                            <Checkbox checked={draft.permissions.includes(permission.id)} onCheckedChange={value => togglePermission(permission.id, value === true)} />
                            <span className="min-w-0">
                                <span className={cn('block text-sm', permission.dangerous ? 'text-danger-text' : 'text-body')}>{t(permission.label)}</span>
                                <span className="block break-all font-mono text-micro text-muted-foreground">{permission.id}</span>
                            </span>
                        </label>)}</div>
                    </div>)}</div>
                </section>
                <DialogFooter><Button variant="secondary" onClick={() => setEditing(null)}>{t('Cancel')}</Button><Button disabled={saving} onClick={save}>{saving ? t('Saving…') : t('Save local access')}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={temporaryCredentials !== null} onOpenChange={open => !open && setTemporaryCredentials(null)}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('Temporary login created')}</DialogTitle>
                    <DialogDescription>{t('Give these credentials to the staff member now. This password is shown once and must be changed on first login.')}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <CopyRow label={t('Username')} value={temporaryCredentials?.username ?? ''} />
                    <CopyRow label={t('Temporary password')} value={temporaryCredentials?.password ?? ''} />
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => {
                        if (!temporaryCredentials) return;
                        void navigator.clipboard.writeText(`${temporaryCredentials.username}\n${temporaryCredentials.password}`);
                        txToast.success(t('Credentials copied.'));
                    }}>{t('Copy credentials')}</Button>
                    <Button onClick={() => setTemporaryCredentials(null)}>{t('Done')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>;
}
