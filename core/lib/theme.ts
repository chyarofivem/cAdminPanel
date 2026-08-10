/*
 * Copyright (c) chyarogroup 2026
 */

export const DEFAULT_ACCENT = 'blue';

export const ACCENTS = {
    blue: {
        label: 'Blue',
        hex: '#2563eb',
        300: '147 197 253',
        500: '59 130 246',
        600: '37 99 235',
        700: '29 78 216',
    },
    indigo: {
        label: 'Indigo',
        hex: '#4f46e5',
        300: '165 180 252',
        500: '99 102 241',
        600: '79 70 229',
        700: '67 56 202',
    },
    violet: {
        label: 'Violet',
        hex: '#7c3aed',
        300: '196 181 253',
        500: '139 92 246',
        600: '124 58 237',
        700: '109 40 217',
    },
    fuchsia: {
        label: 'Fuchsia',
        hex: '#c026d3',
        300: '240 171 252',
        500: '217 70 239',
        600: '192 38 211',
        700: '162 28 175',
    },
    pink: {
        label: 'Pink',
        hex: '#db2777',
        300: '249 168 212',
        500: '236 72 153',
        600: '219 39 119',
        700: '190 24 93',
    },
    rose: {
        label: 'Rose',
        hex: '#e11d48',
        300: '253 164 175',
        500: '244 63 94',
        600: '225 29 72',
        700: '190 18 60',
    },
    red: {
        label: 'Red',
        hex: '#dc2626',
        300: '252 165 165',
        500: '239 68 68',
        600: '220 38 38',
        700: '185 28 28',
    },
    orange: {
        label: 'Orange',
        hex: '#ea580c',
        300: '253 186 116',
        500: '249 115 22',
        600: '234 88 12',
        700: '194 65 12',
    },
    amber: {
        label: 'Amber',
        hex: '#d97706',
        300: '252 211 77',
        500: '245 158 11',
        600: '217 119 6',
        700: '180 83 9',
    },
    emerald: {
        label: 'Emerald',
        hex: '#059669',
        300: '110 231 183',
        500: '16 185 129',
        600: '5 150 105',
        700: '4 120 87',
    },
    teal: {
        label: 'Teal',
        hex: '#0d9488',
        300: '94 234 212',
        500: '20 184 166',
        600: '13 148 136',
        700: '15 118 110',
    },
    cyan: {
        label: 'Cyan',
        hex: '#0891b2',
        300: '103 232 249',
        500: '6 182 212',
        600: '8 145 178',
        700: '14 116 144',
    },
} as const;

export type AccentId = keyof typeof ACCENTS;

export function resolveAccent(id: unknown): AccentId {
    return typeof id === 'string' && Object.prototype.hasOwnProperty.call(ACCENTS, id)
        ? id as AccentId
        : DEFAULT_ACCENT;
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
