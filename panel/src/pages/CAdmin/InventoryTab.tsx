import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { t } from '@/lib/i18n';

type Item = { name: string; label: string };
export default function InventoryTab({ player, refresh }: { player: CadminPlayer; refresh: () => void }) {
    const fetcher = useAuthedFetcher(); const { hasPerm } = useAdminPerms();
    const itemsUrl = cadminApiPath('inventory/items');
    const items = useSWR(itemsUrl, async () => cadminData(await fetcher<CadminResponse<Item[]>>(itemsUrl)));
    const [item, setItem] = useState(''); const [count, setCount] = useState('1');
    const submit = async () => { try { const result = cadminData<any>(await fetcher<CadminResponse>(cadminApiPath('inventory/give'), { method: 'POST', body: { identifier: cadminCharacterIdentifier(player), item, count: Number(count) } })); txToast.success(t(result?.queued ? 'Item queued for next login.' : 'Item given.')); refresh(); } catch (error) { txToast.error(t((error as Error).message)); } };
    return <div className="space-y-4"><div className="text-sm text-muted-foreground">{t('Slots in use')}: {player.inventory?.length ?? 0} · {t('queued offline')}: {player.pendingItems ?? 0}</div><div className="flex flex-wrap gap-2"><select className="h-10 min-w-56 rounded-lg border border-white/10 bg-[#0f1116] px-3 text-sm text-white outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" value={item} onChange={e => setItem(e.target.value)}><option value="">{t('Select ox_inventory item')}</option>{items.data?.map(entry => <option key={entry.name} value={entry.name}>{entry.label} ({entry.name})</option>)}</select><Input className="max-w-28" type="number" min="1" value={count} onChange={e => setCount(e.target.value)} /><Button disabled={!item || !hasPerm('cadmin.inventory.give')} onClick={submit}>{t('Give item')}</Button></div></div>;
}
