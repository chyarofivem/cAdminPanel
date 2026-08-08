import { z } from 'zod';
import { typeDefinedConfig } from './utils';
import { SYM_FIXER_DEFAULT } from '@lib/symbols';

const apiUrl = typeDefinedConfig({
    name: 'chyarologin API URL',
    default: 'https://login.chyaro.xyz',
    validator: z.string().url().max(300).transform(value => value.replace(/\/+$/, '')),
    fixer: SYM_FIXER_DEFAULT,
});

const apiKey = typeDefinedConfig({
    name: 'chyarologin API Key',
    default: '',
    validator: z.string().max(500),
    fixer: SYM_FIXER_DEFAULT,
});

export default { apiUrl, apiKey } as const;
