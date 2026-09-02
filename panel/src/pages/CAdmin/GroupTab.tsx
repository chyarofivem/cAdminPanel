import { useEffect, useState } from 'react';
import { Loader2, LockKeyhole, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { t } from '@/lib/i18n';

const commonGroups = ['user', 'helper', 'mod', 'admin', 'superadmin', 'god'];
const validGroup = /^[A-Za-z0-9_-]+$/;

export default function GroupTab({ player, refresh }: { player: CadminPlayer; refresh: () => void }) {
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const canEdit = hasPerm('cadmin.group.set');
    const [group, setGroup] = useState(player.group ?? 'user');
    const [saving, setSaving] = useState(false);
    const normalizedGroup = group.trim();
    const isValid = normalizedGroup.length > 0 && normalizedGroup.length <= 32 && validGroup.test(normalizedGroup);

    useEffect(() => setGroup(player.group ?? 'user'), [player.identifier, player.group]);

    const submit = async () => {
        if (!isValid || !canEdit || saving) return;
        setSaving(true);
        try {
            const result = cadminData(await fetcher<CadminResponse<{ effective?: string }>>(cadminApiPath('group'), {
                method: 'POST',
                body: { identifier: cadminCharacterIdentifier(player), group: normalizedGroup },
            }));
            setGroup(normalizedGroup);
            //Qbox groups are ACE principals, and one granted in server.cfg is not
            //the panel's to revoke. Saying so beats a success toast next to a
            //group badge that still shows the old value.
            if (result?.effective && result.effective !== normalizedGroup) {
                txToast.warning(t('Saved as {group}, but the server still reports {effective} because another ACE principal (server.cfg) grants it.', {
                    group: normalizedGroup,
                    effective: result.effective,
                }));
            } else {
                txToast.success(t('Group updated and saved.'));
            }
            refresh();
        } catch (error) {
            txToast.error(t((error as Error).message));
        } finally {
            setSaving(false);
        }
    };

    return <section className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.025]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div>
                <h3 className="flex items-center font-medium text-white"><ShieldCheck className="mr-2 size-4 text-brand-400" />{t('Framework group')}</h3>
                <p className="mt-1 text-xs text-zinc-500">{t('This controls the character group used by ESX or the Qbox ACE bridge.')}</p>
            </div>
            <span className="rounded-lg bg-brand-500/10 px-3 py-2 font-mono text-sm text-brand-300">{player.group || 'user'}</span>
        </header>

        <div className="p-5">
            <div className="grid max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div>
                    <Label htmlFor="character-group">{t('New group')}</Label>
                    <Input
                        id="character-group"
                        className="mt-2"
                        value={group}
                        disabled={!canEdit || saving}
                        maxLength={32}
                        pattern="[A-Za-z0-9_-]+"
                        list="character-group-suggestions"
                        autoComplete="off"
                        placeholder="admin"
                        onChange={event => setGroup(event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter') void submit(); }}
                    />
                    <datalist id="character-group-suggestions">{commonGroups.map(entry => <option key={entry} value={entry} />)}</datalist>
                </div>
                <Button disabled={!isValid || saving || !canEdit || normalizedGroup === (player.group || 'user')} onClick={() => void submit()} title={!canEdit ? t('You need the Character Management: Set Group permission.') : undefined}>
                    {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{saving ? t('Saving...') : t('Save group')}
                </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {commonGroups.map(entry => <Button key={entry} type="button" size="xs" variant={group === entry ? 'secondary' : 'outline'} disabled={!canEdit || saving} onClick={() => setGroup(entry)}>{entry}</Button>)}
            </div>

            {!isValid && normalizedGroup && <p className="mt-3 text-xs text-red-300">{t('Use only letters, numbers, dashes, and underscores (32 characters maximum).')}</p>}
            <p className="mt-4 text-xs text-zinc-500">{t('The assignment is saved immediately. Qbox reapplies it after a reconnect, server restart, or cadminpanel resource restart; ESX writes it directly to users.group.')}</p>
            {!canEdit && <p className="mt-3 flex items-center text-xs text-amber-300"><LockKeyhole className="mr-2 size-3.5" />{t('Read-only: you need the Character Management: Set Group permission to edit this value.')}</p>}
        </div>
    </section>;
}
