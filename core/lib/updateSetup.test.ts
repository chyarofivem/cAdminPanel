import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const testEnv = vi.hoisted(() => ({
    root: '',
    txaVersion: '1.0.0',
}));

vi.mock('@core/globalData', () => ({
    txEnv: {
        get txaVersion() { return testEnv.txaVersion; },
        profileSubPath: (...parts: string[]) => path.join(testEnv.root, ...parts),
    },
}));

import {
    compareUpdateVersions,
    completeUpdateSetup,
    getUpdateSetupData,
    initializeUpdateState,
    isUpdateSetupPending,
} from './updateSetup';

describe('post-update setup state', () => {
    beforeEach(async () => {
        testEnv.root = await fs.mkdtemp(path.join(os.tmpdir(), 'cadmin-update-state-'));
        testEnv.txaVersion = '1.0.0';
    });

    afterEach(async () => {
        await fs.rm(testEnv.root, { recursive: true, force: true });
    });

    test('initializes a fresh profile at its installed version', () => {
        initializeUpdateState(true);
        expect(isUpdateSetupPending(true)).toBe(false);
    });

    test('requires only the master to acknowledge every version change', async () => {
        initializeUpdateState(true);
        testEnv.txaVersion = '1.0.1';

        expect(isUpdateSetupPending(true)).toBe(true);
        expect(isUpdateSetupPending(false)).toBe(false);
        expect(getUpdateSetupData()).toMatchObject({
            previousVersion: '1.0.0',
            currentVersion: '1.0.1',
        });

        await completeUpdateSetup({}, 'master');
        expect(isUpdateSetupPending(true)).toBe(false);
    });

    test('compares release and pre-release versions consistently', () => {
        expect(compareUpdateVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
        expect(compareUpdateVersions('1.1.0', '1.0.9')).toBeGreaterThan(0);
        expect(compareUpdateVersions('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
    });
});
