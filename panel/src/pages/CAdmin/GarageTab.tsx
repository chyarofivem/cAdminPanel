import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { useOpenConfirmDialog, useOpenPromptDialog } from '@/hooks/dialogs';
import { t } from '@/lib/i18n';

export default function GarageTab({ player, refresh }: { player: CadminPlayer; refresh: () => void }) {
    const fetcher = useAuthedFetcher();
    const openConfirmDialog = useOpenConfirmDialog();
    const openPromptDialog = useOpenPromptDialog();
    const { hasPerm } = useAdminPerms();
    const [model, setModel] = useState('');
    const [plate, setPlate] = useState('');
    const [reason, setReason] = useState('');
    const canManage = hasPerm('cadmin.garage.manage');
    const act = async (action: string, extra: Record<string, unknown>) => {
        try {
            cadminData(await fetcher<CadminResponse>(cadminApiPath('garage/vehicle'), { method: 'POST', body: { identifier: cadminCharacterIdentifier(player), action, ...extra } }));
            txToast.success(t('Vehicle {action} completed.', { action: t(action) }));
            refresh();
        } catch (error) { txToast.error(t((error as Error).message)); }
    };
    const rename = (oldPlate: string) => {
        openPromptDialog({
            title: t('Change plate {plate}', { plate: oldPlate }),
            message: t('Enter a new plate using up to 8 letters, numbers, or spaces.'),
            placeholder: oldPlate,
            required: true,
            submitLabel: t('Change plate'),
            onSubmit: value => {
                const newPlate = value.trim().toUpperCase();
                if (newPlate && newPlate !== oldPlate) void act('plate', { plate: oldPlate, newPlate });
            },
        });
    };
    const removeVehicle = (vehiclePlate: string) => openConfirmDialog({
        title: t('Delete {plate}?', { plate: vehiclePlate }),
        message: t('This permanently removes the vehicle from the character garage.'),
        actionLabel: t('Delete vehicle'),
        onConfirm: () => { void act('delete', { plate: vehiclePlate }); },
    });
    return <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl bg-white/[0.03]">
            {player.vehicles?.map(vehicle => <div key={vehicle.plate} className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-white/5 px-5 py-4 last:border-0 hover:bg-white/5">
                <div><strong>{vehicle.model || vehicle.vehicle || t('Vehicle')}</strong><div className="font-mono text-xs text-zinc-500">{vehicle.plate} · {vehicle.state || (vehicle.stored ? t('Garaged') : t('Out'))}</div></div>
                <div className="flex flex-wrap gap-2"><Button size="xs" variant="outline" disabled={!canManage} onClick={() => act(vehicle.stored ? 'retrieve' : 'store', { plate: vehicle.plate })}>{vehicle.stored ? t('Take out') : t('Force store')}</Button><Button size="xs" variant="outline" disabled={!canManage} onClick={() => rename(vehicle.plate)}>{t('Plate')}</Button><Button size="xs" variant="destructive" disabled={!canManage} onClick={() => removeVehicle(vehicle.plate)}>{t('Delete')}</Button></div>
            </div>)}
            {!player.vehicles?.length && <p className="p-8 text-center text-zinc-500">{t('This character owns no vehicles.')}</p>}
        </div>
        {canManage && <div className="max-w-2xl rounded-2xl bg-white/[0.03] p-5"><h3 className="font-medium">{t('Give a vehicle')}</h3><p className="mt-1 text-xs text-zinc-500">{t('Added directly to the garage. Leave the plate blank to generate one.')}</p><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><Input value={model} onChange={event => setModel(event.target.value)} placeholder={t('Vehicle model (sultan)')} /><Input value={plate} onChange={event => setPlate(event.target.value.toUpperCase())} maxLength={8} placeholder={t('Plate (optional)')} /></div><Input className="mt-3" value={reason} onChange={event => setReason(event.target.value)} maxLength={200} placeholder={t('Reason')} /><Button className="mt-3 w-full" disabled={!model} onClick={() => act('give', { model, plate: plate || undefined, reason })}>{t('Give vehicle')}</Button></div>}
    </div>;
}
