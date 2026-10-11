import { z } from "zod";
import { typeDefinedConfig } from "./utils";
import { SYM_FIXER_DEFAULT } from "@lib/symbols";


const enabled = typeDefinedConfig({
    name: 'Resource Monitor Enabled',
    default: true,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});

const intervalMinutes = typeDefinedConfig({
    name: 'Resource Monitor Interval',
    default: 5,
    validator: z.number().int().min(1).max(60),
    fixer: SYM_FIXER_DEFAULT,
});

const frames = typeDefinedConfig({
    name: 'Resource Monitor Capture Ticks',
    default: 100,
    validator: z.number().int().min(20).max(500),
    fixer: SYM_FIXER_DEFAULT,
});

const alertThresholdMs = typeDefinedConfig({
    name: 'Resource Monitor Alert Threshold',
    default: 4,
    validator: z.number().min(0.5).max(100),
    fixer: SYM_FIXER_DEFAULT,
});

const alertConsecutive = typeDefinedConfig({
    name: 'Resource Monitor Consecutive Samples',
    default: 2,
    validator: z.number().int().min(1).max(10),
    fixer: SYM_FIXER_DEFAULT,
});

const discordAlerts = typeDefinedConfig({
    name: 'Resource Monitor Discord Alerts',
    default: true,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});


export default {
    enabled,
    intervalMinutes,
    frames,
    alertThresholdMs,
    alertConsecutive,
    discordAlerts,
} as const;
