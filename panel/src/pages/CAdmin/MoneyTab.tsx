import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { t } from '@/lib/i18n';

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
    return <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">{(['cash', 'bank', 'dirty'] as const).map(key => <div key={key} className="rounded-md border p-3"><div className="text-xs uppercase text-muted-foreground">{t(key === 'cash' ? 'Cash' : key === 'bank' ? 'Bank' : 'Dirty')}</div><div className="text-xl font-semibold">{player.money?.[key] ?? 0}</div></div>)}</div>
        <div className="flex flex-wrap gap-2">
            <select className="h-10 rounded-lg border border-white/10 bg-[#0f1116] px-3 text-sm text-white outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" value={account} onChange={e => setAccount(e.target.value)}><option>cash</option><option>bank</option><option>dirty</option></select>
            <select className="h-10 rounded-lg border border-white/10 bg-[#0f1116] px-3 text-sm text-white outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" value={action} onChange={e => setAction(e.target.value)}><option value="add">{t('Add')}</option><option value="remove">{t('Remove')}</option><option value="set">{t('Set')}</option></select>
            <Input className="max-w-40" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t('Amount')} />
            <Button disabled={!amount || !hasPerm(action === 'set' ? 'cadmin.money.set' : 'cadmin.money.give')} onClick={submit}>{t('Apply')}</Button>
        </div>
    </div>;
}
