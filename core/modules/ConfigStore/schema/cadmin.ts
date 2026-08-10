import { z } from 'zod';
import { typeDefinedConfig } from './utils';
import { SYM_FIXER_DEFAULT } from '@lib/symbols';

const item = <T>(name: string, defaultValue: T, validator: z.ZodType<T>) => typeDefinedConfig({
    name,
    default: defaultValue as T extends null ? never : T,
    validator,
    fixer: SYM_FIXER_DEFAULT,
});

export default {
    enabled: item('Character Management Enabled', false, z.boolean()),
    installSkipped: item('Character Management Install Skipped', false, z.boolean()),
    apiUrl: item('Character Management API URL', '', z.string().max(500).refine(value => value === '' || z.string().url().safeParse(value).success, 'Invalid API URL.')),
    apiSecret: item('Character Management API Secret', '', z.string().max(500)),
    dirtyMoneyItem: item('Dirty Money Item', 'black_money', z.string().min(1).max(64)),
    framework: item('Character Framework', 'auto', z.enum(['auto', 'esx', 'qbox'])),
} as const;
