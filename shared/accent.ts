/*
 * Copyright (c) chyarogroup 2026
 */

/**
 * The single accent knob shared by the web panel, the in-game menu and the backend.
 *
 * An accent value is either a preset id (`blue`, `orange`, ...) or a custom colour
 * stored as a lowercase `#rrggbb` string. Every consumer turns that value into the
 * same seven tokens through `accentTokens()`.
 *
 * The output never relies on `color-mix()` or `oklch()`: the in-game browser is
 * CEF/Chrome 103, which supports neither, and the web panel also runs inside it
 * through the WebPipe iframe. Soft, tint and edge are emitted as comma-form rgba().
 */

export const DEFAULT_ACCENT = 'blue';

type PresetShades = {
    label: string;
    /** Filled buttons, active badges, toggles (Tailwind 700). */
    fill: string;
    /** Fill on hover (800). */
    hover: string;
    /** The accent as text or focus ring on dark surfaces (500, or 400 for dark hues). */
    text: string;
    /** Loading bar, hovered accent text (400, or 300 for dark hues). */
    glow: string;
};

/**
 * Tailwind palettes mapped as fill = 700, hover = 800, text = 500, glow = 400.
 * Indigo, violet, purple and red read under 4.5:1 at 500 on the sidebar, so they shift
 * one step lighter for text and glow. Greys are left out on purpose: a grey
 * accent disappears into the surfaces.
 */
export const ACCENT_PRESETS = {
    blue: { label: 'Blue', fill: '#1d4ed8', hover: '#1e40af', text: '#3b82f6', glow: '#60a5fa' },
    indigo: { label: 'Indigo', fill: '#4338ca', hover: '#3730a3', text: '#818cf8', glow: '#a5b4fc' },
    violet: { label: 'Violet', fill: '#6d28d9', hover: '#5b21b6', text: '#a78bfa', glow: '#c4b5fd' },
    purple: { label: 'Purple', fill: '#7e22ce', hover: '#6b21a8', text: '#c084fc', glow: '#d8b4fe' },
    fuchsia: { label: 'Fuchsia', fill: '#a21caf', hover: '#86198f', text: '#d946ef', glow: '#e879f9' },
    pink: { label: 'Pink', fill: '#be185d', hover: '#9d174d', text: '#ec4899', glow: '#f472b6' },
    rose: { label: 'Rose', fill: '#be123c', hover: '#9f1239', text: '#f43f5e', glow: '#fb7185' },
    red: { label: 'Red', fill: '#b91c1c', hover: '#991b1b', text: '#f87171', glow: '#fca5a5' },
    orange: { label: 'Orange', fill: '#c2410c', hover: '#9a3412', text: '#f97316', glow: '#fb923c' },
    amber: { label: 'Amber', fill: '#b45309', hover: '#92400e', text: '#f59e0b', glow: '#fbbf24' },
    yellow: { label: 'Yellow', fill: '#a16207', hover: '#854d0e', text: '#eab308', glow: '#facc15' },
    lime: { label: 'Lime', fill: '#4d7c0f', hover: '#3f6212', text: '#84cc16', glow: '#a3e635' },
    green: { label: 'Green', fill: '#15803d', hover: '#166534', text: '#22c55e', glow: '#4ade80' },
    emerald: { label: 'Emerald', fill: '#047857', hover: '#065f46', text: '#10b981', glow: '#34d399' },
    teal: { label: 'Teal', fill: '#0f766e', hover: '#115e59', text: '#14b8a6', glow: '#2dd4bf' },
    cyan: { label: 'Cyan', fill: '#0e7490', hover: '#155e75', text: '#06b6d4', glow: '#22d3ee' },
    sky: { label: 'Sky', fill: '#0369a1', hover: '#075985', text: '#0ea5e9', glow: '#38bdf8' },
} as const satisfies Record<string, PresetShades>;

export type AccentPresetId = keyof typeof ACCENT_PRESETS;

export type AccentTokens = {
    accent: string;
    accentHover: string;
    accentText: string;
    accentGlow: string;
    accentSoft: string;
    accentTint: string;
    accentEdge: string;
};

export type AccentOption = {
    id: AccentPresetId;
    label: string;
    fill: string;
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** The sidebar surface. Custom accent text must stay readable on it. */
const SIDEBAR_HEX = '#1c1e23';


//MARK: Value helpers
export function isAccentPresetId(value: unknown): value is AccentPresetId {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACCENT_PRESETS, value);
}

export function isCustomAccent(value: unknown): value is string {
    return typeof value === 'string' && HEX_RE.test(value);
}

export function isValidAccent(value: unknown): value is string {
    return isAccentPresetId(value) || isCustomAccent(value);
}

/**
 * Returns a preset id, a lowercase `#rrggbb` custom colour, or the default preset.
 */
export function normalizeAccent(value: unknown): string {
    if (isAccentPresetId(value)) return value;
    if (isCustomAccent(value)) return value.toLowerCase();
    return DEFAULT_ACCENT;
}

export function accentOptions(): AccentOption[] {
    return (Object.keys(ACCENT_PRESETS) as AccentPresetId[]).map((id) => ({
        id,
        label: ACCENT_PRESETS[id].label,
        fill: ACCENT_PRESETS[id].fill,
    }));
}


//MARK: Colour math
type Rgb = [number, number, number];
type Oklch = { l: number; c: number; h: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function hexToRgb(hex: string): Rgb {
    const normalized = hex.replace('#', '');
    return [
        parseInt(normalized.slice(0, 2), 16) / 255,
        parseInt(normalized.slice(2, 4), 16) / 255,
        parseInt(normalized.slice(4, 6), 16) / 255,
    ];
}

function rgbToHex(rgb: Rgb): string {
    return '#' + rgb
        .map((channel) => Math.round(clamp01(channel) * 255).toString(16).padStart(2, '0'))
        .join('');
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklch(rgb: Rgb): Oklch {
    const [r, g, b] = rgb.map(toLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const h = (Math.atan2(B, A) * 180) / Math.PI;
    return { l: L, c: Math.sqrt(A * A + B * B), h: h < 0 ? h + 360 : h };
}

/** Returns gamma-encoded sRGB, possibly outside [0, 1] when the colour is out of gamut. */
function oklchToRawRgb({ l: L, c, h }: Oklch): Rgb {
    const hr = (h * Math.PI) / 180;
    const A = c * Math.cos(hr);
    const B = c * Math.sin(hr);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    return [toGamma(r), toGamma(g), toGamma(b)];
}

const inGamut = (rgb: Rgb) => rgb.every((channel) => channel >= -0.0005 && channel <= 1.0005);

/** Keeps lightness and hue, and lowers chroma until the colour fits in sRGB. */
function oklchToRgb(color: Oklch): Rgb {
    const direct = oklchToRawRgb(color);
    if (inGamut(direct)) return direct;
    let low = 0;
    let high = color.c;
    for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        if (inGamut(oklchToRawRgb({ ...color, c: mid }))) low = mid;
        else high = mid;
    }
    return oklchToRawRgb({ ...color, c: low }).map(clamp01) as Rgb;
}

function relativeLuminance(rgb: Rgb) {
    const [r, g, b] = rgb.map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string) {
    const a = relativeLuminance(hexToRgb(foreground));
    const b = relativeLuminance(hexToRgb(background));
    const [light, dark] = a > b ? [a, b] : [b, a];
    return (light + 0.05) / (dark + 0.05);
}

function rgba(hex: string, alpha: number) {
    const [r, g, b] = hexToRgb(hex).map((channel) => Math.round(channel * 255));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** `r, g, b` channels in comma form, for templates that build their own rgba(). */
export function hexToRgbParts(hex: string) {
    return hexToRgb(hex).map((channel) => Math.round(channel * 255)).join(', ');
}


//MARK: Token derivation
/**
 * Derives the full token set from one custom fill colour:
 * - fill: the chosen colour, darkened in 0.01 OKLCH lightness steps until white
 *   text on it reaches 4.5:1.
 * - hover: the fill with lightness -0.065 and chroma x0.85.
 * - text: the same hue at lightness 0.68, or 0.75 when 0.68 reads under 4.5:1
 *   on the sidebar.
 * - glow: one step lighter than text.
 */
export function deriveCustomAccent(hex: string): Pick<AccentTokens, 'accent' | 'accentHover' | 'accentText' | 'accentGlow'> {
    const source = rgbToOklch(hexToRgb(hex));

    let fill = rgbToHex(hexToRgb(hex));
    let fillColor = { ...source };
    while (contrastRatio('#ffffff', fill) < 4.5 && fillColor.l > 0.01) {
        fillColor = { ...fillColor, l: fillColor.l - 0.01 };
        fill = rgbToHex(oklchToRgb(fillColor));
    }

    const hover = rgbToHex(oklchToRgb({
        l: Math.max(0, fillColor.l - 0.065),
        c: fillColor.c * 0.85,
        h: fillColor.h,
    }));

    let textLightness = 0.68;
    let text = rgbToHex(oklchToRgb({ l: textLightness, c: source.c, h: source.h }));
    if (contrastRatio(text, SIDEBAR_HEX) < 4.5) {
        textLightness = 0.75;
        text = rgbToHex(oklchToRgb({ l: textLightness, c: source.c, h: source.h }));
    }
    const glow = rgbToHex(oklchToRgb({ l: textLightness + 0.08, c: source.c, h: source.h }));

    return { accent: fill, accentHover: hover, accentText: text, accentGlow: glow };
}

export function accentTokens(value: unknown): AccentTokens {
    const normalized = normalizeAccent(value);
    const base = isAccentPresetId(normalized)
        ? {
            accent: ACCENT_PRESETS[normalized].fill,
            accentHover: ACCENT_PRESETS[normalized].hover,
            accentText: ACCENT_PRESETS[normalized].text,
            accentGlow: ACCENT_PRESETS[normalized].glow,
        }
        : deriveCustomAccent(normalized);
    return {
        ...base,
        accentSoft: rgba(base.accent, 0.1),
        accentTint: rgba(base.accent, 0.15),
        accentEdge: rgba(base.accent, 0.2),
    };
}

/**
 * The tokens keyed by CSS custom property name (without the leading `--`).
 */
export function accentCssVars(value: unknown): Record<string, string> {
    const tokens = accentTokens(value);
    return {
        'accent': tokens.accent,
        'accent-hover': tokens.accentHover,
        'accent-text': tokens.accentText,
        'accent-glow': tokens.accentGlow,
        'accent-soft': tokens.accentSoft,
        'accent-tint': tokens.accentTint,
        'accent-edge': tokens.accentEdge,
    };
}

/** A human label for any accent value, used in logs and pickers. */
export function accentLabel(value: unknown) {
    const normalized = normalizeAccent(value);
    return isAccentPresetId(normalized) ? ACCENT_PRESETS[normalized].label : normalized;
}
