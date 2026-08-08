import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { t } from '@/lib/i18n';

export default function GroupTab({ player, refresh }: { player: CadminPlayer; refresh: () => void }) {
    const fetcher = useAuthedFetcher(); const { hasPerm } = useAdminPerms(); const [group, setGroup] = useState(player.group ?? 'user');
    const submit = async () => { try { cadminData(await fetcher<CadminResponse>(cadminApiPath('group'), { method: 'POST', body: { identifier: cadminCharacterIdentifier(player), group } })); txToast.success(t('Group updated.')); refresh(); } catch (error) { txToast.error(t((error as Error).message)); } };
    return <div className="space-y-3"><p>{t('Current group')}: <strong>{player.group || 'user'}</strong></p><div className="flex max-w-lg gap-2"><Input value={group} onChange={e => setGroup(e.target.value)} placeholder="admin" /><Button disabled={!group || !hasPerm('cadmin.group.set')} onClick={submit}>{t('Set group')}</Button></div></div>;
}
