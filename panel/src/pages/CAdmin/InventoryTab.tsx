import { useState } from 'react';
import useSWR from 'swr';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { nativeSelectClass } from './nativeSelect';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Item = { name: string; label: string };
export default function InventoryTab({ player, refresh }: { player: CadminPlayer; refresh: () => void }) {
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const itemsUrl = cadminApiPath('inventory/items');
    const items = useSWR(itemsUrl, async () => cadminData(await fetcher<CadminResponse<Item[]>>(itemsUrl)));
    const [item, setItem] = useState('');
    const [count, setCount] = useState('1');
    const submit = async () => {
        try {
            const result = cadminData<any>(await fetcher<CadminResponse>(cadminApiPath('inventory/give'), {
                method: 'POST',
                body: { identifier: cadminCharacterIdentifier(player), item, count: Number(count) },
            }));
            txToast.success(t(result?.queued ? 'Item queued for next login.' : 'Item given.'));
            refresh();
        } catch (error) {
            txToast.error(t((error as Error).message));
        }
    };

    return <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
            {t('Slots in use')}: <span className="tabular-nums text-white">{player.inventory?.length ?? 0}</span>
            {' · '}
            {t('queued offline')}: <span className="tabular-nums text-white">{player.pendingItems ?? 0}</span>
        </p>
        {items.error && <Alert variant="destructive">{items.error.message}</Alert>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
                aria-label={t('Select ox_inventory item')}
                className={cn(nativeSelectClass, 'sm:w-auto sm:min-w-56')}
                value={item}
                onChange={e => setItem(e.target.value)}
            >
                <option value="">{t('Select ox_inventory item')}</option>
                {items.data?.map(entry => <option key={entry.name} value={entry.name}>{entry.label} ({entry.name})</option>)}
            </select>
            <Input aria-label={t('Amount')} className="tabular-nums sm:max-w-28" type="number" min="1" value={count} onChange={e => setCount(e.target.value)} />
        </div>
        <Button className="self-start" disabled={!item || !hasPerm('cadmin.inventory.give')} onClick={submit}>{t('Give item')}</Button>
    </div>;
}
