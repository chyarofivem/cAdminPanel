import { z } from "zod";
import { typeDefinedConfig } from "./utils";
import { SYM_FIXER_DEFAULT } from "@lib/symbols";
import localeMap from "@shared/localeMap";
import { ACCENTS, DEFAULT_ACCENT } from "@lib/theme";
import { isStoredBrandingFilename } from "@lib/branding";


const serverName = typeDefinedConfig({
    name: 'Server Name',
    default: 'change-me',
    validator: z.string().min(1).max(18),
    fixer: SYM_FIXER_DEFAULT,
});

const language = typeDefinedConfig({
    name: 'Language',
    default: 'en',
    validator: z.string().min(2).refine(
        (value) => localeMap[value] !== undefined,
        (value) => ({ message: `Invalid language code \`${value ?? '??'}\`.` }),
    ),
    fixer: SYM_FIXER_DEFAULT,
});

const accent = typeDefinedConfig({
    name: 'Accent Colour',
    default: DEFAULT_ACCENT,
    validator: z.enum(Object.keys(ACCENTS) as [keyof typeof ACCENTS, ...(keyof typeof ACCENTS)[]]),
    fixer: SYM_FIXER_DEFAULT,
});

const brandingFilename = (name: string) => typeDefinedConfig({
    name,
    default: '',
    validator: z.string().refine(value => value === '' || isStoredBrandingFilename(value), 'Invalid branding filename.'),
    fixer: SYM_FIXER_DEFAULT,
});


export default {
    serverName,
    language,
    accent,
    logoUrl: brandingFilename('Panel Logo'),
    faviconUrl: brandingFilename('Panel Favicon'),
    bannerUrl: brandingFilename('Panel Banner'),
} as const;
