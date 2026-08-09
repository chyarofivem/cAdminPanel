import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AlertCircle, Car, Loader2, LockKeyhole, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthedFetcher } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { cadminApiPath, cadminCharacterIdentifier, cadminData, type CadminPlayer, type CadminResponse } from './api';
import { useOpenConfirmDialog, useOpenPromptDialog } from '@/hooks/dialogs';
import { t } from '@/lib/i18n';

type GarageVehicle = {
    plate: string;
    model?: string;
    vehicle?: string;
    garage?: string;
    state?: string;
    stored?: boolean;
};

export default function GarageTab({ player, refresh }: { player: CadminPlayer; refresh: () => void }) {
    const fetcher = useAuthedFetcher();
    const openConfirmDialog = useOpenConfirmDialog();
    const openPromptDialog = useOpenPromptDialog();
    const { hasPerm } = useAdminPerms();
    const canView = hasPerm('cadmin.garage.view');
    const canManage = hasPerm('cadmin.garage.manage');
    const identifier = cadminCharacterIdentifier(player);
    const garageUrl = canView ? cadminApiPath(`garage/${encodeURIComponent(identifier)}`) : null;
    const garage = useSWR<GarageVehicle[]>(garageUrl, async url => (
        cadminData(await fetcher<CadminResponse<GarageVehicle[]>>(url))
    ));
    const [model, setModel] = useState('');
    const [plate, setPlate] = useState('');
    const [reason, setReason] = useState('');
    const [busyAction, setBusyAction] = useState('');

    useEffect(() => {
        if (!garage.data && player.vehicles) void garage.mutate(player.vehicles as GarageVehicle[], { revalidate: false });
    }, [garage, player.vehicles]);

    const act = async (action: string, extra: Record<string, unknown>) => {
        if (!canManage || busyAction) return;
        const busyKey = `${action}:${String(extra.plate ?? model)}`;
        setBusyAction(busyKey);
        try {
            const result = cadminData<{ plate?: string }>(await fetcher<CadminResponse<{ plate?: string }>>(cadminApiPath('garage/vehicle'), {
                method: 'POST',
                body: { identifier, action, ...extra },
            }));
            txToast.success(action === 'give' && result?.plate
                ? t('Vehicle added with plate {plate}.', { plate: result.plate })
                : t('Vehicle {action} completed.', { action: t(action) }));
            if (action === 'give') {
                setModel('');
                setPlate('');
                setReason('');
            }
            await garage.mutate();
            refresh();
        } catch (error) {
            txToast.error(t((error as Error).message));
        } finally {
            setBusyAction('');
        }
    };

    const rename = (oldPlate: string) => {
        if (!canManage) return;
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

    const removeVehicle = (vehiclePlate: string) => {
        if (!canManage) return;
        openConfirmDialog({
            title: t('Delete {plate}?', { plate: vehiclePlate }),
            message: t('This permanently removes the vehicle from the character garage.'),
            actionLabel: t('Delete vehicle'),
            onConfirm: () => { void act('delete', { plate: vehiclePlate }); },
        });
    };

    if (!canView) return <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-6">
        <h3 className="flex items-center font-medium text-amber-200"><LockKeyhole className="mr-2 size-4" />{t('Garage access is read-only')}</h3>
        <p className="mt-2 text-sm text-amber-200/70">{t('You need the Character Management: View Garage permission to see this character’s vehicles.')}</p>
    </section>;

    const vehicles = garage.data ?? (player.vehicles as GarageVehicle[] | undefined);

    return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <section className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.025]">
            <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
                <div>
                    <h3 className="flex items-center font-medium text-white"><Car className="mr-2 size-4 text-brand-400" />{t('Owned vehicles')}</h3>
                    <p className="mt-1 text-xs text-zinc-500">{t('{count} vehicles in the framework garage', { count: vehicles?.length ?? 0 })}</p>
                </div>
                <Button size="sm" variant="outline" disabled={garage.isLoading || Boolean(busyAction)} onClick={() => void garage.mutate()}><RefreshCw className={`mr-2 size-3.5 ${garage.isLoading ? 'animate-spin' : ''}`} />{t('Refresh')}</Button>
            </header>

            {garage.error && <div className="m-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <span className="flex items-center"><AlertCircle className="mr-2 size-4" />{garage.error.message || t('The garage could not be loaded.')}</span>
                <Button size="sm" variant="outline" onClick={() => void garage.mutate()}>{t('Try again')}</Button>
            </div>}

            {garage.isLoading && !vehicles && <div className="flex items-center justify-center p-12 text-sm text-zinc-500"><Loader2 className="mr-2 size-4 animate-spin" />{t('Loading garage...')}</div>}
            {vehicles?.map(vehicle => {
                const actionKey = `${vehicle.stored ? 'retrieve' : 'store'}:${vehicle.plate}`;
                return <div key={vehicle.plate} className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-white/5 px-5 py-4 last:border-0 hover:bg-white/[0.025]">
                    <div className="min-w-0">
                        <strong className="block truncate text-zinc-100">{vehicle.model || vehicle.vehicle || t('Vehicle')}</strong>
                        <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-xs text-zinc-500">
                            <span>{vehicle.plate}</span><span>·</span><span>{vehicle.state || (vehicle.stored ? t('Garaged') : t('Out'))}</span>{vehicle.garage && <><span>·</span><span>{vehicle.garage}</span></>}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="xs" variant="outline" disabled={!canManage || Boolean(busyAction)} onClick={() => void act(vehicle.stored ? 'retrieve' : 'store', { plate: vehicle.plate })}>{busyAction === actionKey && <Loader2 className="mr-1 size-3 animate-spin" />}{vehicle.stored ? t('Mark out') : t('Force store')}</Button>
                        <Button size="xs" variant="outline" disabled={!canManage || Boolean(busyAction)} onClick={() => rename(vehicle.plate)}>{t('Change plate')}</Button>
                        <Button size="xs" variant="destructive" disabled={!canManage || Boolean(busyAction)} onClick={() => removeVehicle(vehicle.plate)}>{t('Delete')}</Button>
                    </div>
                </div>;
            })}
            {!garage.isLoading && !garage.error && vehicles?.length === 0 && <p className="p-12 text-center text-sm text-zinc-500">{t('This character owns no vehicles.')}</p>}
        </section>

        <section className="h-fit rounded-2xl border border-white/5 bg-white/[0.025] p-5">
            <h3 className="flex items-center font-medium text-white"><Plus className="mr-2 size-4 text-brand-400" />{t('Give a vehicle')}</h3>
            <p className="mt-1 text-xs text-zinc-500">{t('The vehicle is added directly to the configured garage. Leave the plate blank to generate one.')}</p>
            <div className="mt-5 space-y-4">
                <div><Label htmlFor="garage-model">{t('Vehicle model')}</Label><Input id="garage-model" className="mt-2" value={model} disabled={!canManage || Boolean(busyAction)} maxLength={64} onChange={event => setModel(event.target.value)} placeholder="sultan" /></div>
                <div><Label htmlFor="garage-plate">{t('Plate (optional)')}</Label><Input id="garage-plate" className="mt-2 font-mono uppercase" value={plate} disabled={!canManage || Boolean(busyAction)} maxLength={8} onChange={event => setPlate(event.target.value.toUpperCase())} placeholder={t('Auto-generate')} /></div>
                <div><Label htmlFor="garage-reason">{t('Reason')}</Label><Input id="garage-reason" className="mt-2" value={reason} disabled={!canManage || Boolean(busyAction)} maxLength={200} onChange={event => setReason(event.target.value)} placeholder={t('Optional staff note')} /></div>
                <Button className="w-full" disabled={!canManage || !model.trim() || Boolean(busyAction)} onClick={() => void act('give', { model: model.trim(), plate: plate.trim() || undefined, reason: reason.trim() })} title={!canManage ? t('You need the Character Management: Manage Garage permission.') : undefined}>
                    {busyAction.startsWith('give:') ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}{busyAction.startsWith('give:') ? t('Adding...') : t('Add to garage')}
                </Button>
            </div>
            {!canManage && <p className="mt-4 flex items-center text-xs text-amber-300"><LockKeyhole className="mr-2 size-3.5" />{t('Read-only: you need the Character Management: Manage Garage permission to edit vehicles.')}</p>}
        </section>
    </div>;
}
