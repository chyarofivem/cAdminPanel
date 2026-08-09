import { useState } from 'react';
import { DatabaseBackup, ShieldAlert, Trash2, UserX } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useBackendApi } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import { t } from '@/lib/i18n';

type ActionResponse = { error?: string; msElapsed?: number; playersRemoved?: number; actionsRemoved?: number; hwidsRemoved?: number; cntRemoved?: number };

const selectClass = 'h-10 w-full rounded-lg border border-white/10 bg-[#0f1116] px-3 text-sm text-white outline-none focus:border-brand-600';

export default function MasterActionsPage() {
    const [working, setWorking] = useState(false);
    const [cleanup, setCleanup] = useState({ players: '60d', bans: 'revoked', warns: '30d', hwids: 'none' });
    const [allowlistFilter, setAllowlistFilter] = useState('30d');
    const actionApi = useBackendApi<ActionResponse, Record<string, string>>({ method: 'POST', path: '/masterActions/:action' });

    const run = async (action: 'cleanDatabase' | 'revokeWhitelists', data: Record<string, string>) => {
        if (!window.confirm(t('This action changes stored player data. Continue?'))) return;
        setWorking(true);
        try {
            const result = await actionApi({ pathParams: { action }, data });
            if (!result || result.error) throw new Error(result?.error || t('The action failed.'));
            const count = action === 'cleanDatabase'
                ? (result.playersRemoved ?? 0) + (result.actionsRemoved ?? 0) + (result.hwidsRemoved ?? 0)
                : result.cntRemoved ?? 0;
            txToast.success(t('{count} records updated.', { count }));
        } catch (error) {
            txToast.error(error instanceof Error ? error.message : t('The action failed.'));
        } finally {
            setWorking(false);
        }
    };

    return <div className="mb-10 w-full">
        <PageHeader title={t('Master Actions')} icon={<ShieldAlert className="size-6" />} />
        <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <div className="flex items-start gap-3"><DatabaseBackup className="mt-1 size-5 text-brand-500" /><div><h2 className="text-lg font-semibold">{t('Database backup')}</h2><p className="mt-1 text-sm text-zinc-400">{t('Download players, actions, and allowlist requests before maintenance.')}</p></div></div>
                <Button className="mt-6" variant="outline" onClick={() => { window.location.href = '/masterActions/backupDatabase'; }}><DatabaseBackup className="mr-2 size-4" />{t('Download backup')}</Button>
            </section>
            <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.035] p-6">
                <div className="flex items-start gap-3"><UserX className="mt-1 size-5 text-red-400" /><div><h2 className="text-lg font-semibold">{t('Allowlist maintenance')}</h2><p className="mt-1 text-sm text-zinc-400">{t('Revoke license allowlist entries by last connection time.')}</p></div></div>
                <select className={`${selectClass} mt-6`} value={allowlistFilter} onChange={event => setAllowlistFilter(event.target.value)}><option value="30d">{t('Inactive for 30 days')}</option><option value="15d">{t('Inactive for 15 days')}</option><option value="7d">{t('Inactive for 7 days')}</option><option value="all">{t('All allowlist entries')}</option></select>
                <Button className="mt-4" variant="destructive" disabled={working} onClick={() => run('revokeWhitelists', { filter: allowlistFilter })}><UserX className="mr-2 size-4" />{t('Revoke entries')}</Button>
            </section>
            <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.035] p-6 xl:col-span-2">
                <div className="flex items-start gap-3"><Trash2 className="mt-1 size-5 text-red-400" /><div><h2 className="text-lg font-semibold">{t('Database cleanup')}</h2><p className="mt-1 text-sm text-zinc-400">{t('Choose each record class explicitly. Saved player notes are preserved.')}</p></div></div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <CleanupSelect label={t('Players')} value={cleanup.players} options={[['none', 'Keep all'], ['60d', 'Inactive 60 days'], ['30d', 'Inactive 30 days'], ['15d', 'Inactive 15 days']]} onChange={players => setCleanup({ ...cleanup, players })} />
                    <CleanupSelect label={t('Bans')} value={cleanup.bans} options={[['none', 'Keep all'], ['revoked', 'Revoked'], ['revokedExpired', 'Revoked or expired'], ['all', 'Remove all']]} onChange={bans => setCleanup({ ...cleanup, bans })} />
                    <CleanupSelect label={t('Warnings')} value={cleanup.warns} options={[['none', 'Keep all'], ['revoked', 'Revoked'], ['30d', 'Older than 30 days'], ['15d', 'Older than 15 days'], ['7d', 'Older than 7 days'], ['all', 'Remove all']]} onChange={warns => setCleanup({ ...cleanup, warns })} />
                    <CleanupSelect label="HWIDs" value={cleanup.hwids} options={[['none', 'Keep all'], ['players', 'Remove from players'], ['bans', 'Remove from bans'], ['all', 'Remove all']]} onChange={hwids => setCleanup({ ...cleanup, hwids })} />
                </div>
                <Button className="mt-5" variant="destructive" disabled={working} onClick={() => run('cleanDatabase', cleanup)}><Trash2 className="mr-2 size-4" />{t('Run cleanup')}</Button>
            </section>
        </div>
    </div>;
}

function CleanupSelect({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
    return <label className="space-y-2 text-sm font-medium"><span>{label}</span><select className={selectClass} value={value} onChange={event => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{t(text)}</option>)}</select></label>;
}
