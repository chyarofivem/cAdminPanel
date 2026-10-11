import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Section from '@/components/Section';
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

    return <Section
        title={t('Framework group')}
        description={t('This controls the character group used by ESX or the Qbox ACE bridge.')}
        actions={<div className="flex items-center gap-2 text-dense">
            <span className="text-muted-foreground">{t('Current group')}</span>
            <Badge className="font-mono">{player.group || 'user'}</Badge>
        </div>}
    >
        <div className="flex max-w-3xl flex-col gap-4">
            <div className="flex flex-col gap-2">
                <Label htmlFor="character-group">{t('New group')}</Label>
                <Input
                    id="character-group"
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
                {!isValid && normalizedGroup && <p className="text-dense text-danger-text">{t('Use only letters, numbers, dashes, and underscores (32 characters maximum).')}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
                {commonGroups.map(entry => <Button
                    key={entry}
                    type="button"
                    size="xs"
                    variant={group === entry ? 'secondary' : 'ghost'}
                    aria-pressed={group === entry}
                    disabled={!canEdit || saving}
                    onClick={() => setGroup(entry)}
                >{entry}</Button>)}
            </div>

            <p className="text-dense text-muted-foreground">{t('The assignment is saved immediately. Qbox reapplies it after a reconnect, server restart, or cadminpanel resource restart; ESX writes it directly to users.group.')}</p>

            <Button
                className="self-start"
                disabled={!isValid || saving || !canEdit || normalizedGroup === (player.group || 'user')}
                onClick={() => void submit()}
                title={!canEdit ? t('You need the Character Management: Set Group permission.') : undefined}
            >
                {saving ? t('Saving...') : t('Save group')}
            </Button>
            {!canEdit && <p className="text-dense text-warning-text">{t('Read-only: you need the Character Management: Set Group permission to edit this value.')}</p>}
        </div>
    </Section>;
}
