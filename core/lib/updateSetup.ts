const modulename = 'UpdateSetup';
import fs from 'node:fs';
import path from 'node:path';
import consoleFactory from '@lib/console';
import { txEnv } from '@core/globalData';
import type {
    UpdateSetupData,
    UpdateSetupField,
    UpdateSetupFieldType,
    UpdateSetupRelease,
} from '@shared/updateSetupApiTypes';
const console = consoleFactory(modulename);

type UpdateState = {
    schemaVersion: 1;
    lastAcknowledgedVersion: string;
};

type UpdateFieldDefinition = {
    id: string;
    label: string;
    description: string;
    type: UpdateSetupFieldType;
    required?: boolean;
    placeholder?: string;
    getValue?: () => string | undefined;
    validate?: (value: string) => string | undefined;
    apply: (value: string, author: string) => void | Promise<void>;
};

type UpdateReleaseDefinition = UpdateSetupRelease & {
    fields?: UpdateFieldDefinition[];
};

const STATE_SCHEMA_VERSION = 1;
const UPDATE_STATE_FILE = 'update-state.json';

// Add one entry for every release. New configuration requirements belong in
// fields and are applied server-side. Clients never receive configuration paths.
const updateManifest: UpdateReleaseDefinition[] = [
    {
        version: '1.0.0',
        title: 'Modern administration release',
        changes: [
            'History now uses a responsive activity timeline under Administration.',
            'Allowlist is organized under Server and CFG Editor is organized under System.',
            'Recipe deployment now runs entirely in the modern panel.',
            'The legacy web interface and Diagnostics page have been removed.',
            'Future updates use this page for release notes and required settings.',
        ],
    },
];

const stateFilePath = () => txEnv.profileSubPath('data', UPDATE_STATE_FILE);

const parseVersion = (version: string) => {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+](.*))?$/);
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        suffix: match[4] ?? '',
    };
};

export const compareUpdateVersions = (left: string, right: string) => {
    const a = parseVersion(left);
    const b = parseVersion(right);
    if (!a || !b) return left.localeCompare(right);
    for (const key of ['major', 'minor', 'patch'] as const) {
        if (a[key] !== b[key]) return a[key] - b[key];
    }
    if (a.suffix === b.suffix) return 0;
    if (!a.suffix) return 1;
    if (!b.suffix) return -1;
    return a.suffix.localeCompare(b.suffix);
};

const readUpdateState = (): UpdateState | null => {
    try {
        const parsed = JSON.parse(fs.readFileSync(stateFilePath(), 'utf8')) as Partial<UpdateState>;
        if (
            parsed.schemaVersion !== STATE_SCHEMA_VERSION
            || typeof parsed.lastAcknowledgedVersion !== 'string'
            || !parsed.lastAcknowledgedVersion.length
        ) throw new Error('invalid update state');
        return parsed as UpdateState;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.warn(`Unable to read ${UPDATE_STATE_FILE}; the master will be asked to review the update.`);
            console.verbose.dir(error);
        }
        return null;
    }
};

const writeUpdateState = (lastAcknowledgedVersion: string) => {
    const target = stateFilePath();
    const temporary = `${target}.tmp`;
    const data: UpdateState = {
        schemaVersion: STATE_SCHEMA_VERSION,
        lastAcknowledgedVersion,
    };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
    fs.renameSync(temporary, target);
};

export const initializeUpdateState = (isNewProfile: boolean) => {
    if (!isNewProfile || readUpdateState()) return;
    writeUpdateState(txEnv.txaVersion);
};

export const isUpdateSetupPending = (isMaster: boolean) => {
    if (!isMaster) return false;
    return readUpdateState()?.lastAcknowledgedVersion !== txEnv.txaVersion;
};

const pendingReleases = (previousVersion: string | null) => {
    const isUpgrade = previousVersion !== null
        && compareUpdateVersions(previousVersion, txEnv.txaVersion) < 0;
    const releases = isUpgrade
        ? updateManifest.filter(release => (
            compareUpdateVersions(release.version, previousVersion) > 0
            && compareUpdateVersions(release.version, txEnv.txaVersion) <= 0
        ))
        : updateManifest.filter(release => release.version === txEnv.txaVersion);

    if (releases.length) return releases.sort((a, b) => compareUpdateVersions(b.version, a.version));
    return [{
        version: txEnv.txaVersion,
        title: 'Version changed',
        changes: [`The panel version changed${previousVersion ? ` from ${previousVersion}` : ''} to ${txEnv.txaVersion}.`],
        fields: [],
    }] satisfies UpdateReleaseDefinition[];
};

const publicField = (version: string, field: UpdateFieldDefinition): UpdateSetupField => {
    const storedValue = field.getValue?.();
    const isSecret = field.type === 'password';
    return {
        id: field.id,
        version,
        label: field.label,
        description: field.description,
        type: field.type,
        required: field.required ?? true,
        placeholder: field.placeholder,
        value: isSecret ? undefined : storedValue,
        hasStoredValue: isSecret ? Boolean(storedValue) : undefined,
    };
};

export const getUpdateSetupData = (): UpdateSetupData => {
    const state = readUpdateState();
    const releases = pendingReleases(state?.lastAcknowledgedVersion ?? null);
    return {
        previousVersion: state?.lastAcknowledgedVersion ?? null,
        currentVersion: txEnv.txaVersion,
        releases: releases.map(({ version, title, changes }) => ({ version, title, changes })),
        fields: releases.flatMap(release => (
            release.fields ?? []
        ).map(field => publicField(release.version, field))),
    };
};

export const completeUpdateSetup = async (rawValues: unknown, author: string) => {
    const data = getUpdateSetupData();
    const values = rawValues && typeof rawValues === 'object' && !Array.isArray(rawValues)
        ? rawValues as Record<string, unknown>
        : {};
    const definitions = pendingReleases(data.previousVersion)
        .flatMap(release => (release.fields ?? []).map(field => ({ release, field })));

    const prepared = new Map<string, string>();
    for (const { field } of definitions) {
        const rawValue = values[field.id];
        const value = typeof rawValue === 'string' ? rawValue.trim() : '';
        const hasExistingValue = Boolean(field.getValue?.());
        if ((field.required ?? true) && !value && !hasExistingValue) {
            throw new Error(`${field.label} is required.`);
        }
        if (!value && hasExistingValue) continue;
        const validationError = field.validate?.(value);
        if (validationError) throw new Error(validationError);
        prepared.set(field.id, value);
    }

    for (const { field } of definitions) {
        const value = prepared.get(field.id);
        if (value !== undefined) await field.apply(value, author);
    }
    writeUpdateState(txEnv.txaVersion);
};
