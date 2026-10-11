import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import Section from '@/components/Section';
import { Button } from '@/components/ui/button';
import { useAuthedFileDownload, useBackendApi } from '@/hooks/fetch';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { txToast } from '@/components/TxToaster';
import { t } from '@/lib/i18n';

type ActionResponse = { error?: string; msElapsed?: number; playersRemoved?: number; actionsRemoved?: number; hwidsRemoved?: number; cntRemoved?: number };

//Native selects styled as the design system input: sunken, radius-sm, hairline ring, accent focus ring.
const selectClass = 'h-11 w-full rounded-sm bg-sunken px-3 text-sm text-white ring-1 ring-inset ring-hairline transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text disabled:cursor-not-allowed disabled:opacity-50';

export default function MasterActionsPage() {
    const [working, setWorking] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [cleanup, setCleanup] = useState({ players: '60d', bans: 'revoked', warns: '30d', hwids: 'none' });
    const [allowlistFilter, setAllowlistFilter] = useState('30d');
    const actionApi = useBackendApi<ActionResponse, Record<string, string>>({ method: 'POST', path: '/masterActions/:action' });
    const downloadFile = useAuthedFileDownload();
    const openConfirmDialog = useOpenConfirmDialog();

    const downloadBackup = async () => {
        setDownloading(true);
        try {
            await downloadFile('/masterActions/backupDatabase');
        } catch (error) {
            txToast.error(error instanceof Error ? error.message : t('The download failed.'));
        } finally {
            setDownloading(false);
        }
    };

    const run = async (action: 'cleanDatabase' | 'revokeWhitelists', data: Record<string, string>) => {
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

    //Every destructive action is confirmed explicitly before it runs.
    const confirmRun = (
        action: 'cleanDatabase' | 'revokeWhitelists',
        data: Record<string, string>,
        title: string,
        actionLabel: string,
    ) => {
        if (working) return;
        openConfirmDialog({
            title,
            message: t('This action changes stored player data. Continue?'),
            actionLabel,
            confirmBtnVariant: 'destructive',
            onConfirm: () => void run(action, data),
        });
    };

    return <div className="mb-10 w-full">
        <PageHeader title={t('Master Actions')} />
        <div className="flex flex-col gap-6">
            <Section
                title={t('Database backup')}
                description={t('Download players, actions, and allowlist requests before maintenance.')}
            >
                <Button disabled={downloading} onClick={downloadBackup}>
                    {downloading ? t('Downloading...') : t('Download backup')}
                </Button>
            </Section>

            <Section
                title={t('Allowlist maintenance')}
                description={t('Revoke license allowlist entries by last connection time.')}
            >
                <div className="flex max-w-md flex-col gap-4">
                    <select
                        className={selectClass}
                        aria-label={t('Allowlist maintenance')}
                        value={allowlistFilter}
                        onChange={event => setAllowlistFilter(event.target.value)}
                    >
                        <option value="30d">{t('Inactive for 30 days')}</option>
                        <option value="15d">{t('Inactive for 15 days')}</option>
                        <option value="7d">{t('Inactive for 7 days')}</option>
                        <option value="all">{t('All allowlist entries')}</option>
                    </select>
                    <div>
                        <Button
                            variant="outline-destructive"
                            disabled={working}
                            onClick={() => confirmRun('revokeWhitelists', { filter: allowlistFilter }, t('Allowlist maintenance'), t('Revoke entries'))}
                        >
                            {t('Revoke entries')}
                        </Button>
                    </div>
                </div>
            </Section>

            <Section
                title={t('Database cleanup')}
                description={t('Choose each record class explicitly. Saved player notes are preserved.')}
            >
                <div className="flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <CleanupSelect label={t('Players')} value={cleanup.players} options={[['none', 'Keep all'], ['60d', 'Inactive 60 days'], ['30d', 'Inactive 30 days'], ['15d', 'Inactive 15 days']]} onChange={players => setCleanup({ ...cleanup, players })} />
                        <CleanupSelect label={t('Bans')} value={cleanup.bans} options={[['none', 'Keep all'], ['revoked', 'Revoked'], ['revokedExpired', 'Revoked or expired'], ['all', 'Remove all']]} onChange={bans => setCleanup({ ...cleanup, bans })} />
                        <CleanupSelect label={t('Warnings')} value={cleanup.warns} options={[['none', 'Keep all'], ['revoked', 'Revoked'], ['30d', 'Older than 30 days'], ['15d', 'Older than 15 days'], ['7d', 'Older than 7 days'], ['all', 'Remove all']]} onChange={warns => setCleanup({ ...cleanup, warns })} />
                        <CleanupSelect label="HWIDs" value={cleanup.hwids} options={[['none', 'Keep all'], ['players', 'Remove from players'], ['bans', 'Remove from bans'], ['all', 'Remove all']]} onChange={hwids => setCleanup({ ...cleanup, hwids })} />
                    </div>
                    <div>
                        <Button
                            variant="outline-destructive"
                            disabled={working}
                            onClick={() => confirmRun('cleanDatabase', cleanup, t('Database cleanup'), t('Run cleanup'))}
                        >
                            {t('Run cleanup')}
                        </Button>
                    </div>
                </div>
            </Section>
        </div>
    </div>;
}

function CleanupSelect({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
    return <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-white">{label}</span>
        <select className={selectClass} value={value} onChange={event => onChange(event.target.value)}>
            {options.map(([key, text]) => <option key={key} value={key}>{t(text)}</option>)}
        </select>
    </label>;
}
