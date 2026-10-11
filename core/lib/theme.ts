/*
 * Copyright (c) chyarogroup 2026
 */
import {
    ACCENT_PRESETS,
    DEFAULT_ACCENT,
    accentCssVars,
    accentOptions as sharedAccentOptions,
    accentTokens,
    isValidAccent,
    normalizeAccent,
} from '@shared/accent';

export { ACCENT_PRESETS, DEFAULT_ACCENT, accentTokens, isValidAccent };

/**
 * An accent value: a preset id or a lowercase `#rrggbb` custom colour.
 * Use `resolveAccent()` on anything read from disk or a request.
 */
export type AccentValue = string;

export function resolveAccent(value: unknown): AccentValue {
    return normalizeAccent(value);
}

/** The CSS custom properties for an accent, keyed without the leading `--`. */
export function accentVars(value: unknown) {
    return accentCssVars(value);
}

/** The fill colour as hex. This is what the game resource receives as `accentColor`. */
export function accentFillHex(value: unknown) {
    return accentTokens(value).accent;
}

export function accentOptions() {
    return sharedAccentOptions().map((option) => ({
        ...option,
        vars: accentCssVars(option.id),
    }));
}
