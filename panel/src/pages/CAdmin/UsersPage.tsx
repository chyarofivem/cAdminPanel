import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthedFetcher } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import TxAnchor from '@/components/TxAnchor';
import CAdminLayout from './CAdminLayout';
import { cadminApiPath, cadminData, type CadminResponse, type ChyaroUser } from './api';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { t } from '@/lib/i18n';

type UsersData = { users: ChyaroUser[]; total: number };

export default function UsersPage() {
    const fetcher = useAuthedFetcher();
    const openConfirmDialog = useOpenConfirmDialog();
    const [query, setQuery] = useState('');
    const [submitted, setSubmitted] = useState('');
    const [working, setWorking] = useState<string | null>(null);
    const url = `${cadminApiPath('users')}${submitted ? `?q=${encodeURIComponent(submitted)}` : ''}`;
    const swr = useSWR(url, async () => cadminData(await fetcher<CadminResponse<UsersData>>(url)));
    const performUnlink = async (user: ChyaroUser) => {
        setWorking(user.id);
        try {
            cadminData(await fetcher<CadminResponse>(cadminApiPath(`users/${encodeURIComponent(user.id)}/unlink`), { method: 'POST' }));
            txToast.success(t('Unlinked {email}.', { email: user.email }));
            await swr.mutate();
        } catch (error) { txToast.error(error instanceof Error ? t(error.message) : t('The unlink failed.')); }
        finally { setWorking(null); }
    };
    const unlink = (user: ChyaroUser) => openConfirmDialog({
        title: t('Unlink {name}?', { name: user.fivemName || t('FiveM character') }),
        message: t('This removes the FiveM link from {email}. It does not delete the chyarologin account or change txAdmin permissions.', { email: user.email }),
        actionLabel: t('Unlink account'),
        onConfirm: () => { void performUnlink(user); },
    });
    const data = swr.data;
    return <CAdminLayout title={t('Linked Accounts')}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div><p className="text-sm text-zinc-400">{t('Verified identity data from chyarologin. It does not grant or change panel permissions.')}</p>{data && <p className="mt-1 text-xs text-zinc-500">{t('Showing {shown} of {total} accounts.', { shown: data.users.length, total: data.total })}</p>}</div>
            <form className="flex w-full max-w-md gap-2" onSubmit={event => { event.preventDefault(); setSubmitted(query.trim()); }}><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Email, Discord, or FiveM name')} /><Button type="submit">{t('Search')}</Button></form>
        </div>
        {swr.error && <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{swr.error.message}</div>}
        <div className="mt-6 overflow-hidden rounded-2xl bg-white/5">
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-dashed border-white/5 text-xs uppercase tracking-widest text-neutral-500"><tr><th className="px-6 py-3 text-left font-medium">{t('Account')}</th><th className="px-6 py-3 text-left font-medium">{t('Discord identity')}</th><th className="px-6 py-3 text-left font-medium">{t('FiveM identity')}</th><th className="px-6 py-3" /></tr></thead><tbody className="divide-y divide-dashed divide-white/5">{data?.users.map(user => <tr key={user.id} className="transition hover:bg-white/5"><td className="px-6 py-4"><p className="font-medium">{user.email}</p><p className="font-mono text-xs text-zinc-600">{user.id}</p></td><td className="px-6 py-4 text-zinc-300">{user.discordUsername || user.discordId || <span className="text-zinc-600">{t('not linked')}</span>}</td><td className="px-6 py-4">{user.fivemLicense ? <><TxAnchor href={`/administration/players/${encodeURIComponent(user.fivemLicense.replace(/^license2?:/, ''))}`} className="text-zinc-300">{user.fivemName || t('linked character')}</TxAnchor><p className="max-w-56 truncate font-mono text-xs text-zinc-600">{user.fivemLicense}</p></> : <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-500">{t('unlinked')}</span>}</td><td className="px-6 py-4 text-right">{user.fivemLicense && <Button size="sm" variant="destructive" disabled={working === user.id} onClick={() => unlink(user)}>{t('Unlink')}</Button>}</td></tr>)}</tbody></table></div>
            {!swr.isLoading && !data?.users.length && <p className="px-6 py-12 text-center text-sm text-zinc-500">{t('No accounts found.')}</p>}
            {swr.isLoading && <p className="px-6 py-12 text-center text-sm text-zinc-500">{t('Loading identities…')}</p>}
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t('Manage staff access locally under')} <TxAnchor href="/admins">{t('Staff & Permissions')}</TxAnchor>.</p>
    </CAdminLayout>;
}
