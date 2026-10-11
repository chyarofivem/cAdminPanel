import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { nativeSelectClass } from './nativeSelect';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function MoneyTab({ player, refresh }: { player: CadminPlayer; refresh: () => void }) {
    const fetcher = useAuthedFetcher();
    const { hasPerm } = useAdminPerms();
    const [account, setAccount] = useState('cash');
    const [action, setAction] = useState('add');
    const [amount, setAmount] = useState('');
    const submit = async () => {
        try {
            cadminData(await fetcher<CadminResponse>(cadminApiPath('money'), { method: 'POST', body: { identifier: cadminCharacterIdentifier(player), account, action, amount: Number(amount) } }));
            txToast.success(t('Money updated.')); setAmount(''); refresh();
        } catch (error) { txToast.error(t((error as Error).message)); }
    };
    return <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-4 rounded-lg bg-raise p-4 sm:p-6">
            {(['cash', 'bank', 'dirty'] as const).map(key => <div key={key} className="min-w-0">
                <dt className="text-dense text-muted-foreground">{t(key === 'cash' ? 'Cash' : key === 'bank' ? 'Bank' : 'Dirty')}</dt>
                <dd className="mt-1 truncate text-lg font-semibold tabular-nums text-white">{(player.money?.[key] ?? 0).toLocaleString()}</dd>
            </div>)}
        </dl>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select className={cn(nativeSelectClass, 'sm:w-auto')} value={account} onChange={e => setAccount(e.target.value)}><option>cash</option><option>bank</option><option>dirty</option></select>
            <select className={cn(nativeSelectClass, 'sm:w-auto')} value={action} onChange={e => setAction(e.target.value)}><option value="add">{t('Add')}</option><option value="remove">{t('Remove')}</option><option value="set">{t('Set')}</option></select>
            <Input className="tabular-nums sm:max-w-40" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t('Amount')} />
        </div>
        <Button className="self-start" disabled={!amount || !hasPerm(action === 'set' ? 'cadmin.money.set' : 'cadmin.money.give')} onClick={submit}>{t('Apply')}</Button>
    </div>;
}
