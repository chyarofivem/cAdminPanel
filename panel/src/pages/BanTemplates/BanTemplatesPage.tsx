import { useAdminPerms } from "@/hooks/auth";
import { useOpenConfirmDialog } from "@/hooks/dialogs";
import { useEffect, useState } from "react";
import BanTemplatesInputDialog from "./BanTemplatesInputDialog";
import BanTemplatesListItem from "./BanTemplatesListItem";
import BanTemplatesListAddButton from "./BanTemplatesListAddButton";
import { BanDurationType, BanTemplatesDataType, GetBanTemplatesSuccessResp, SaveBanTemplatesReq, SaveBanTemplatesResp } from "@shared/otherTypes";
import { DndSortableGroup, DndSortableItem } from "@/components/dndSortable";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { BackendApiError, useBackendApi } from "@/hooks/fetch";
import useSWR from "swr";
import { alphanumeric } from 'nanoid-dictionary';
import { customAlphabet } from "nanoid";
import { PageHeader } from "@/components/page-header";
import EmptyState from "@/components/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
const nanoid = customAlphabet(alphanumeric, 21);


export type BanTemplatesInputData = {
    id: string | null;
    reason: string;
    duration: BanDurationType;
}

type DataUpdaterFunc = (prev: BanTemplatesDataType[]) => BanTemplatesDataType[];

function BanTemplatesPageInner() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [reasonInputDialogData, setReasonInputDialogData] = useState<BanTemplatesInputData | undefined>();
    const openConfirmDialog = useOpenConfirmDialog();
    const { hasPerm } = useAdminPerms();
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaveSuccessful, setIsSaveSuccessful] = useState(false);

    const queryApi = useBackendApi<GetBanTemplatesSuccessResp>({
        method: 'GET',
        path: `/settings/banTemplates`,
        throwGenericErrors: true,
    });

    const saveApi = useBackendApi<SaveBanTemplatesResp, SaveBanTemplatesReq>({
        method: 'POST',
        path: `/settings/banTemplates`,
        throwGenericErrors: true,
    });

    const swr = useSWR('/settings/banTemplates', async () => {
        const data = await queryApi({});
        if (!data) throw new Error('No data returned');
        return data;
    }, {
        isPaused: () => (isSaving || !!saveError || isDialogOpen),
    });

    const updateBackend = async (updater: DataUpdaterFunc) => {
        setIsSaving(true);
        setSaveError(null);
        setIsSaveSuccessful(false);
        try {
            const data = await swr.mutate(updater as any, false);
            const resp = await saveApi({ data });
            if (!resp) throw new Error('No data returned');
            setIsSaveSuccessful(true);
        } catch (error) {
            if (error instanceof BackendApiError || error instanceof Error) {
                setSaveError(error.message);
            } else {
                setSaveError(JSON.stringify(error));
            }
        } finally {
            setIsSaving(false);
        }
    }

    //Clear the save successful after 5 seconds
    useEffect(() => {
        if (!isSaveSuccessful) return;
        const timeout = setTimeout(() => {
            setIsSaveSuccessful(false);
        }, 5000);
        return () => clearTimeout(timeout);
    }, [isSaveSuccessful]);


    //Drag and drop
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            updateBackend((items) => {
                const oldIndex = items.findIndex(x => x.id === active.id);
                const newIndex = items.findIndex(x => x.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    const handleOnSave = ({ id, reason, duration }: BanTemplatesInputData) => {
        if (id) {
            updateBackend((prev) =>
                prev.map((item) =>
                    item.id === id ? { id, reason, duration } : item
                )
            );
        } else {
            updateBackend((prev) => [
                ...prev,
                {
                    id: nanoid(21),
                    reason,
                    duration
                },
            ]);
        }
        setIsDialogOpen(false);
        setReasonInputDialogData(undefined);
    }

    //Handler for list actions
    const handleRemoveItem = (id: string) => {
        if (!id || !swr.data) return;
        const toBeRemoved = swr.data.find((item) => item.id === id);
        if (!toBeRemoved) return;
        openConfirmDialog({
            title: t('Remove this ban template?'),
            actionLabel: t('Remove'),
            confirmBtnVariant: 'destructive',
            message: <span className="break-words text-white">{toBeRemoved.reason}</span>,
            onConfirm: () => {
                console.log('Remove confirmed', id);
                updateBackend((prev) => prev.filter((item) => item.id !== id));
            },
        });
    }
    const handleEditItem = (id: string) => {
        if (!id || !swr.data) return;
        console.log('Edit item', id);
        setReasonInputDialogData(swr.data.find((item) => item.id === id));
        setIsDialogOpen(true);
    }
    const handleAddNewItem = () => {
        setReasonInputDialogData(undefined);
        setIsDialogOpen(true);
    }


    //Status display
    let statusNode: React.ReactNode;
    if (swr.error) {
        const retryFunc = () => swr.mutate();
        const errMsg = swr?.error?.message ?? 'unknown error';
        statusNode = <span className="inline-flex flex-wrap items-center gap-x-2">
            <span className="text-danger-text">{t('Unable to load ban templates.')} {errMsg}</span>
            <Button variant="link" className="text-dense" onClick={retryFunc}>{t('Try again')}</Button>
        </span>
    } else if (isSaving) {
        statusNode = <span className="text-muted-foreground">
            {t('Saving...')}
        </span>
    } else if (saveError) {
        const retryFunc = () => {
            if (!swr.data) return;
            updateBackend(() => swr.data!);
        }
        const errMsg = saveError ?? 'unknown error';
        statusNode = <span className="inline-flex flex-wrap items-center gap-x-2">
            <span className="text-danger-text">{t('Could not save ban templates: {error}', { error: errMsg })}</span>
            <Button variant="link" className="text-dense" onClick={retryFunc}>{t('Try again')}</Button>
        </span>
    } else if (isSaveSuccessful) {
        statusNode = <span className="text-success-text">
            {t('Saved')}
        </span>
    } else if (swr.isLoading || swr.isValidating) {
        statusNode = <span className="text-muted-foreground">
            {t('Loading...')}
        </span>
    }

    //Rendering
    const canEdit = hasPerm('settings.write');
    return <>
        <PageHeader
            title={t('Ban Templates')}
            subtitle={t('Configure ban reasons and durations that will appear as dropdown options when banning a player. This is useful for common reasons that happen frequently, like violation of your server rules.')}
            parentName={t('Settings')}
            parentLink="/settings"
        >
            <BanTemplatesListAddButton onClick={handleAddNewItem} disabled={!canEdit || !swr.data} />
        </PageHeader>
        <div className="flex w-full max-w-screen-lg flex-col gap-6">
            {!canEdit && <Alert variant="warning">
                <AlertDescription>{t('Read-only: you need the Settings: Change permission to edit ban templates.')}</AlertDescription>
            </Alert>}
            <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="text-base font-semibold text-white">
                        {t('Templates')} <span className="font-normal tabular-nums text-muted-foreground">{swr.data?.length ?? 0}</span>
                    </h2>
                    <div role="status" aria-live="polite" className="text-dense">{statusNode}</div>
                </div>
                {canEdit && <p className="text-dense text-muted-foreground">{t('Drag a template by its handle to reorder the list.')}</p>}

                {!swr.data && !saveError && (
                    <p className="text-sm text-muted-foreground">{t('Loading...')}</p>
                )}
                {swr.data && !swr.data.length && (
                    <EmptyState message={t('You do not have any ban templates configured.')} />
                )}
                {swr.data && swr.data.length > 0 && (
                    <DndSortableGroup
                        className="flex flex-col gap-2"
                        ids={swr.data.map((item) => item.id)}
                        onDragEnd={handleDragEnd}
                    >
                        {swr.data.map((item) => (
                            <DndSortableItem
                                key={item.id}
                                id={item.id}
                                disabled={!canEdit}
                            >
                                <BanTemplatesListItem
                                    onEdit={handleEditItem}
                                    onRemove={handleRemoveItem}
                                    disabled={!canEdit}
                                    {...item}
                                />
                            </DndSortableItem>
                        ))}
                    </DndSortableGroup>
                )}
            </section>
        </div>
        <BanTemplatesInputDialog
            key={reasonInputDialogData?.id}
            reasonData={reasonInputDialogData}
            onSave={handleOnSave}
            isDialogOpen={isDialogOpen}
            setIsDialogOpen={setIsDialogOpen}
        />
    </>;
}


export default function BanTemplatesPage() {
    return (
        <div className="w-full pb-8">
            <BanTemplatesPageInner />
        </div>
    )
}
