/*
 * Copyright (c) chyarogroup 2026
 */

export const DEFAULT_ACCENT = 'blue';

export const ACCENTS = {
    blue: {
        label: 'Blue',
        hex: '#2563eb',
        300: '0.809 0.105 251.813',
        500: '0.623 0.214 259.815',
        600: '0.546 0.245 262.881',
        700: '0.488 0.243 264.376',
    },
    indigo: {
        label: 'Indigo',
        hex: '#4f46e5',
        300: '0.785 0.115 274.713',
        500: '0.585 0.233 277.117',
        600: '0.511 0.262 276.966',
        700: '0.457 0.24 277.023',
    },
    violet: {
        label: 'Violet',
        hex: '#7c3aed',
        300: '0.811 0.111 293.571',
        500: '0.606 0.25 292.717',
        600: '0.541 0.281 293.009',
        700: '0.491 0.27 292.581',
    },
    fuchsia: {
        label: 'Fuchsia',
        hex: '#c026d3',
        300: '0.833 0.145 321.434',
        500: '0.667 0.295 322.15',
        600: '0.591 0.293 322.896',
        700: '0.518 0.253 323.949',
    },
    pink: {
        label: 'Pink',
        hex: '#db2777',
        300: '0.823 0.12 346.018',
        500: '0.656 0.241 354.308',
        600: '0.592 0.249 0.584',
        700: '0.525 0.223 3.958',
    },
    rose: {
        label: 'Rose',
        hex: '#e11d48',
        300: '0.81 0.117 11.638',
        500: '0.645 0.246 16.439',
        600: '0.586 0.253 17.585',
        700: '0.514 0.222 16.935',
    },
    red: {
        label: 'Red',
        hex: '#dc2626',
        300: '0.808 0.114 19.571',
        500: '0.637 0.237 25.331',
        600: '0.577 0.245 27.325',
        700: '0.505 0.213 27.518',
    },
    orange: {
        label: 'Orange',
        hex: '#ea580c',
        300: '0.837 0.128 66.29',
        500: '0.705 0.213 47.604',
        600: '0.646 0.222 41.116',
        700: '0.553 0.195 38.402',
    },
    amber: {
        label: 'Amber',
        hex: '#d97706',
        300: '0.879 0.169 91.605',
        500: '0.769 0.188 70.08',
        600: '0.666 0.179 58.318',
        700: '0.555 0.163 48.998',
    },
    emerald: {
        label: 'Emerald',
        hex: '#059669',
        300: '0.845 0.143 164.978',
        500: '0.696 0.17 162.48',
        600: '0.596 0.145 163.225',
        700: '0.508 0.118 165.612',
    },
    teal: {
        label: 'Teal',
        hex: '#0d9488',
        300: '0.855 0.138 181.071',
        500: '0.704 0.14 182.503',
        600: '0.6 0.118 184.704',
        700: '0.511 0.096 186.391',
    },
    cyan: {
        label: 'Cyan',
        hex: '#0891b2',
        300: '0.865 0.127 207.078',
        500: '0.715 0.143 215.221',
        600: '0.609 0.126 221.723',
        700: '0.52 0.105 223.128',
    },
} as const;

export type AccentId = keyof typeof ACCENTS;

export function resolveAccent(id: unknown): AccentId {
    return typeof id === 'string' && id in ACCENTS ? id as AccentId : DEFAULT_ACCENT;
}

export function accentVars(id: unknown) {
    const accent = ACCENTS[resolveAccent(id)];
    return {
        'brand-300': accent[300],
        'brand-500': accent[500],
        'brand-600': accent[600],
        'brand-700': accent[700],
    };
}

export function accentOptions() {
    return Object.entries(ACCENTS).map(([id, accent]) => ({
        id: id as AccentId,
        label: accent.label,
        vars: accentVars(id),
    }));
}
