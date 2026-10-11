import { Settings2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useState } from "react";
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { DndSortableGroup, DndSortableItem } from "@/components/dndSortable";


type BanTemplateLineProps = {
    text: string;
    disabled: boolean;
    onEdit: () => void;
    onRemove: () => void;
}

function BanTemplateLine({ text, disabled, onEdit, onRemove }: BanTemplateLineProps) {
    return (<>
        <div className="grow flex items-center justify-items-start gap-2">
            <span className="line-clamp-1">
                {text}
            </span>
        </div>
        <div className="flex gap-1">
            <IconButton label="Edit" icon={<Settings2Icon />} onClick={onEdit} disabled={disabled} />
            <IconButton label="Remove" icon={<XIcon />} onClick={onRemove} disabled={disabled} />
        </div>
    </>);
}


const defaultList = [
    'apple',
    'banana',
    'cherry',
    'elderberry',
    'fig',
    'grape',
];

export default function TmpDndSortable() {
    const [items, setItems] = useState(defaultList);

    //Drag and drop
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    //Meus controled
    const handleAdd = () => {
        const newName = Math.random().toString(36).substring(2, 15);
        setItems(curr => [...curr, newName])
    }
    const handleAddRandom = () => {
        const newName = Math.random().toString(36).substring(2, 15);
        const index = Math.floor(Math.random() * items.length);
        setItems(curr => [...curr.slice(0, index), newName, ...curr.slice(index)]);
    }
    const handleRemoveRandom = () => {
        setItems(curr => {
            const index = Math.floor(Math.random() * curr.length);
            return [...curr.slice(0, index), ...curr.slice(index + 1)];
        });
    }
    const handleRemoveItem = (id: string) => {
        console.log('Remove item', id);
        setItems(curr => curr.filter(item => item !== id));
    }
    const handlePrintState = () => {
        console.log(items);
    }
    const handleReset = () => {
        setItems(defaultList);
    }

    return (
        <div className='mx-auto w-full max-w-[500px] space-y-4'>
            <div className='flex w-full flex-wrap justify-center gap-2'>
                <Button size="sm" variant="secondary" onClick={handleAdd}>Add bottom</Button>
                <Button size="sm" variant="secondary" onClick={handleAddRandom}>Add random</Button>
                <Button size="sm" variant="outline-destructive" onClick={handleRemoveRandom}>Remove random</Button>
                <Button size="sm" variant="secondary" onClick={handleReset}>Reset</Button>
                <Button size="sm" variant="secondary" onClick={handlePrintState}>Print</Button>
            </div>

            <DndSortableGroup
                className="space-y-2"
                ids={items}
                onDragEnd={handleDragEnd}
            >
                {items.map((item) => (
                    <DndSortableItem key={item} id={item} disabled={false}>
                        <BanTemplateLine
                            text={item}
                            disabled={false}
                            onEdit={() => alert(`Editing ${item}`)}
                            onRemove={() => handleRemoveItem(item)}
                        />
                    </DndSortableItem>
                ))}
                {/* NOTE: Here you can add extra components inside the <ol> */}
            </DndSortableGroup>
        </div>
    )
}
