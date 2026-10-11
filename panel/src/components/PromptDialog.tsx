import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClosePromptDialog, usePromptDialogState } from "@/hooks/dialogs";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { AutosizeTextarea } from "./ui/autosize-textarea";
import { t } from '@/lib/i18n';


export default function PromptDialog() {
    const inputRef = useRef<any>(null);
    const dialogState = usePromptDialogState();
    const closeDialog = useClosePromptDialog();

    const handleSubmit = () => {
        if (!dialogState.isOpen) return;
        closeDialog();
        const input = inputRef.current?.value ?? inputRef.current?.textArea.value ?? '';
        dialogState.onSubmit(input.trim());
    }

    const handleForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleSubmit();
    }

    const handleOpenClose = (newOpenState: boolean) => {
        if (!dialogState.isOpen) return;
        if (!newOpenState) {
            closeDialog();
            if (dialogState.onCancel) {
                dialogState.onCancel();
            }
        }
    }

    return (
        <Dialog open={dialogState.isOpen} onOpenChange={handleOpenClose}>
            <DialogContent className={cn(dialogState.isWide && "md:max-w-2xl")}>
                <form onSubmit={handleForm} className="grid gap-6">
                    <DialogHeader>
                        <DialogTitle>{dialogState.title}</DialogTitle>
                        <DialogDescription>
                            {dialogState.message}
                        </DialogDescription>
                    </DialogHeader>

                    {dialogState.isMultiline ? (
                        <AutosizeTextarea
                            autoFocus
                            ref={inputRef}
                            placeholder={dialogState.placeholder}
                            autoComplete="off"
                            required={dialogState.required}
                            minHeight={100}
                            maxHeight={240}

                            //Remove line breaks from the input value
                            onChange={(e) => {
                                e.target.value = e.target.value.replace(/\n\s*/g, ' ').trimStart();
                            }}
                        />
                    ) : (
                        <Input
                            autoFocus
                            ref={inputRef}
                            placeholder={dialogState.placeholder}
                            autoComplete="off"
                            required={dialogState.required}
                        />
                    )}
                    {dialogState.suggestions?.length ? (
                        <div className="flex flex-wrap gap-2" aria-label={t('Suggestions')}>
                            {dialogState.suggestions.map((suggestion, index) => (
                                <Button
                                    key={index}
                                    type="button"
                                    size="xs"
                                    variant="secondary"
                                    onClick={() => {
                                        inputRef.current!.value = suggestion;
                                        handleSubmit();
                                    }}
                                >
                                    {suggestion}
                                </Button>
                            ))}
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => handleOpenClose(false)}>
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant={dialogState.submitBtnVariant ?? 'default'}
                        >
                            {dialogState.submitLabel ?? t('Submit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
