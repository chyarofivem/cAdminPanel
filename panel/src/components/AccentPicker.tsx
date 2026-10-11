import { useEffect, useId, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { accentTokens, DEFAULT_ACCENT, isCustomAccent, isValidAccent, normalizeAccent } from '@shared/accent';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

const CUSTOM_OPTION = 'custom';

type AccentPickerProps = {
    /** A preset id (`blue`) or a lowercase `#rrggbb` custom colour. */
    value: string;
    /**
     * Called with a preset id or a lowercase `#rrggbb` colour. While the native colour
     * picker is dragged this fires on every input event, so callers that save to the
     * backend must debounce.
     */
    onChange: (value: string) => void;
    disabled?: boolean;
    /** Given to the select trigger, so an outer `<Label htmlFor>` points at it. */
    id?: string;
};

function Swatch({ color, className }: { color?: string; className?: string }) {
    return <span
        aria-hidden="true"
        className={cn('size-3 shrink-0 rounded-full', !color && 'bg-raise-3', className)}
        style={color ? { backgroundColor: color } : undefined}
    />;
}

/**
 * The accent picker: one select with every preset, then "Custom colour", which reveals
 * a native colour input. The stored value is the preset id or the custom `#rrggbb`.
 */
export default function AccentPicker({ value, onChange, disabled, id }: AccentPickerProps) {
    const fallbackId = useId();
    const triggerId = id ?? `accent-picker-${fallbackId}`;
    const colorInputId = `${triggerId}-custom`;
    const helperId = `${triggerId}-help`;

    const presets = window.txConsts.accents;
    const current = normalizeAccent(value);
    const isCustom = isCustomAccent(current);

    //Remembers the last custom colour, so leaving "Custom colour" and coming back restores it
    const lastCustomRef = useRef<string | null>(isCustom ? current : null);
    useEffect(() => {
        if (isCustom) lastCustomRef.current = current;
    }, [current, isCustom]);

    const emit = (next: string) => {
        if (!isValidAccent(next)) return;
        onChange(normalizeAccent(next));
    };

    const handleSelect = (selected: string) => {
        if (selected === CUSTOM_OPTION) {
            //Start from the last custom colour, or from the fill of the preset in use
            emit(lastCustomRef.current ?? accentTokens(current).accent.toLowerCase());
        } else {
            emit(selected);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <Select
                value={isCustom ? CUSTOM_OPTION : current}
                onValueChange={handleSelect}
                disabled={disabled}
            >
                <SelectTrigger id={triggerId}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                            <span className="flex min-w-0 items-center gap-2">
                                <Swatch color={preset.fill} />
                                <span className="truncate">
                                    {preset.id === DEFAULT_ACCENT
                                        ? t('{name} (default)', { name: t(preset.label) })
                                        : t(preset.label)}
                                </span>
                            </span>
                        </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_OPTION}>
                        <span className="flex min-w-0 items-center gap-2">
                            <Swatch color={isCustom ? accentTokens(current).accent : undefined} />
                            <span className="truncate">{t('Custom colour')}</span>
                        </span>
                    </SelectItem>
                </SelectContent>
            </Select>

            {isCustom && <>
                <label
                    htmlFor={colorInputId}
                    className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-sm bg-sunken px-3 ring-1 ring-inset ring-hairline transition-shadow duration-150 focus-within:ring-2 focus-within:ring-accent-text',
                        disabled && 'cursor-not-allowed opacity-50',
                    )}
                >
                    <input
                        id={colorInputId}
                        type="color"
                        value={current}
                        disabled={disabled}
                        aria-describedby={helperId}
                        onChange={(event) => emit(event.target.value.toLowerCase())}
                        className="h-7 w-10 shrink-0 cursor-pointer appearance-none rounded-xs border-0 bg-transparent p-0 focus-visible:outline-none disabled:cursor-not-allowed [&::-moz-color-swatch]:rounded-xs [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-xs [&::-webkit-color-swatch]:border-0"
                    />
                    <span className="min-w-0 truncate text-sm text-white">{t('Custom colour')}</span>
                    <span className="ml-auto font-mono text-sm text-white">{current}</span>
                </label>
                <p id={helperId} className="text-dense text-muted-foreground">
                    {t('A colour too light for white text is darkened until the text is readable.')}
                </p>
            </>}
        </div>
    );
}
