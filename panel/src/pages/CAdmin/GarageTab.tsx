import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { RefreshCwIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EmptyState from '@/components/EmptyState';
import { ListRow, ListRows } from '@/components/ListRow';
import Section from '@/components/Section';
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
    const garage = useSWR<GarageVehicle[]>(garageUrl, async (url: string) => (
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

    if (!canView) return <Alert variant="warning">
        <AlertTitle>{t('Garage access is read-only')}</AlertTitle>
        <AlertDescription>{t('You need the Character Management: View Garage permission to see this character’s vehicles.')}</AlertDescription>
    </Alert>;

    const vehicles = garage.data ?? (player.vehicles as GarageVehicle[] | undefined);
    const isBusy = Boolean(busyAction);

    return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-white">{t('Owned vehicles')}</h2>
                    <p className="mt-1 text-dense tabular-nums text-muted-foreground">{t('{count} vehicles in the framework garage', { count: vehicles?.length ?? 0 })}</p>
                </div>
                <IconButton
                    label={t('Refresh')}
                    icon={<RefreshCwIcon />}
                    disabled={garage.isLoading || isBusy}
                    onClick={() => void garage.mutate()}
                />
            </div>

            {garage.error && <Alert variant="destructive" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{garage.error.message || t('The garage could not be loaded.')}</span>
                <Button size="sm" variant="secondary" className="self-start sm:self-auto" onClick={() => void garage.mutate()}>{t('Try again')}</Button>
            </Alert>}

            {garage.isLoading && !vehicles && <p role="status" className="rounded-lg bg-raise p-4 text-sm text-muted-foreground sm:p-6">{t('Loading garage...')}</p>}

            {vehicles && vehicles.length > 0 && <ListRows>
                {vehicles.map(vehicle => {
                    const actionKey = `${vehicle.stored ? 'retrieve' : 'store'}:${vehicle.plate}`;
                    return <ListRow key={vehicle.plate} className="flex-col items-stretch sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <p className="min-w-0 truncate font-medium text-white">{vehicle.model || vehicle.vehicle || t('Vehicle')}</p>
                                <Badge variant={vehicle.stored ? 'default' : 'info'}>{vehicle.state || (vehicle.stored ? t('Garaged') : t('Out'))}</Badge>
                            </div>
                            <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-xs text-muted-foreground">
                                <span>{vehicle.plate}</span>
                                {vehicle.garage && <><span aria-hidden="true">·</span><span>{vehicle.garage}</span></>}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" disabled={!canManage || isBusy} onClick={() => void act(vehicle.stored ? 'retrieve' : 'store', { plate: vehicle.plate })}>
                                {busyAction === actionKey ? t('Saving...') : vehicle.stored ? t('Mark out') : t('Force store')}
                            </Button>
                            <Button size="sm" variant="secondary" disabled={!canManage || isBusy} onClick={() => rename(vehicle.plate)}>{t('Change plate')}</Button>
                            <Button size="sm" variant="outline-destructive" disabled={!canManage || isBusy} onClick={() => removeVehicle(vehicle.plate)}>{t('Delete')}</Button>
                        </div>
                    </ListRow>;
                })}
            </ListRows>}

            {!garage.isLoading && !garage.error && vehicles?.length === 0 && <EmptyState message={t('This character owns no vehicles.')} />}
        </div>

        <Section
            title={t('Give a vehicle')}
            description={t('The vehicle is added directly to the configured garage. Leave the plate blank to generate one.')}
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="garage-model">{t('Vehicle model')}</Label>
                    <Input id="garage-model" value={model} disabled={!canManage || isBusy} maxLength={64} onChange={event => setModel(event.target.value)} placeholder="sultan" />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="garage-plate">{t('Plate (optional)')}</Label>
                    <Input id="garage-plate" className="font-mono uppercase" value={plate} disabled={!canManage || isBusy} maxLength={8} onChange={event => setPlate(event.target.value.toUpperCase())} placeholder={t('Auto-generate')} />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="garage-reason">{t('Reason')}</Label>
                    <Input id="garage-reason" value={reason} disabled={!canManage || isBusy} maxLength={200} onChange={event => setReason(event.target.value)} placeholder={t('Optional staff note')} />
                </div>
                <Button
                    className="self-start"
                    disabled={!canManage || !model.trim() || isBusy}
                    onClick={() => void act('give', { model: model.trim(), plate: plate.trim() || undefined, reason: reason.trim() })}
                    title={!canManage ? t('You need the Character Management: Manage Garage permission.') : undefined}
                >
                    {busyAction.startsWith('give:') ? t('Adding...') : t('Add to garage')}
                </Button>
                {!canManage && <p className="text-dense text-warning-text">{t('Read-only: you need the Character Management: Manage Garage permission to edit vehicles.')}</p>}
            </div>
        </Section>
    </div>;
}
