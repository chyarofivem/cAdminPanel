import { cn } from "@/lib/utils";
import { GripVerticalIcon } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { t } from '@/lib/i18n';


type DndSortableItemProps = {
    id: string;
    disabled?: boolean;
    className?: string;
    children: React.ReactNode;
}

export function DndSortableItem({ id, disabled, className, children }: DndSortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id, disabled });

    attributes.role = 'listitem'; //Override role due to having a drag handle
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform && {
            ...transform,
            scaleY: 1, //prevent default squishing behavior for multiline items
        }),
        transition,
    };

    return (
        <li
            ref={setNodeRef} style={style} {...attributes}
            className={cn(
                //Same shape as a ListRow; the row being dragged is only dimmed.
                "relative flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg bg-raise py-3 pl-2 pr-4 aria-pressed:z-50 aria-pressed:opacity-85 sm:pr-5",
                className
            )}
        >
            <div
                {...listeners}
                title={t('Drag to reorder')}
                aria-label={t('Drag to reorder')}
                className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors duration-150",
                    disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-grab hover:bg-raise hover:text-white active:cursor-grabbing"
                )}
            >
                <GripVerticalIcon className="size-4" aria-hidden="true" />
            </div>
            {children}
        </li>
    )
}


type DndSortableGroupProps = {
    onDragEnd: (event: DragEndEvent) => void;
    children: React.ReactNode;
    className?: string;
    ids: string[];
}

export function DndSortableGroup({ onDragEnd, className, children, ids }: DndSortableGroupProps) {
    const [autoAnimateParentRef, enableAnimations] = useAutoAnimate();
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        onDragEnd(event);
        setTimeout(() => {
            enableAnimations(true);
        }, 1);
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => enableAnimations(false)}
            onDragCancel={() => enableAnimations(true)}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={ids}
                strategy={verticalListSortingStrategy}
            >
                <ol
                    ref={autoAnimateParentRef}
                    className={className}
                >
                    {children}
                </ol>
            </SortableContext>
        </DndContext>
    )
}
