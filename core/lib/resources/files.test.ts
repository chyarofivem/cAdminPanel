import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    FolderSwapError,
    checkResourceFolder,
    createBackup,
    findManifestRoot,
    isPathInside,
    isResourceReplaceable,
    isValidBackupId,
    isValidResourceName,
    listAllBackups,
    listBackups,
    makeBackupId,
    pruneBackups,
    replaceFolder,
    resolveRealResourceFolder,
} from './files';

let tmpRoot: string;
let fixtureCount = 0;
const newDir = (...parts: string[]) => {
    const dir = path.join(tmpRoot, `case-${++fixtureCount}`, ...parts);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};
const writeFile = (filePath: string, content = '') => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
};

beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cadmin-resfiles-'));
});
afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});


describe('names and ids', () => {
    it('validates resource names', () => {
        expect(isValidResourceName('ox_lib')).toBe(true);
        expect(isValidResourceName('my-res.v2')).toBe(true);
        expect(isValidResourceName('..')).toBe(false);
        expect(isValidResourceName('a/b')).toBe(false);
        expect(isValidResourceName('[local]')).toBe(false);
        expect(isValidResourceName('')).toBe(false);
    });

    it('builds and validates backup ids', () => {
        expect(makeBackupId(1760000000000, 'v1.2.3')).toBe('1760000000000_1.2.3');
        expect(makeBackupId(1760000000000, '')).toBe('1760000000000_unknown');
        expect(makeBackupId(1760000000000, '../../evil')).toBe('1760000000000_evil');
        expect(makeBackupId(1760000000000, '1.0 beta/2')).toBe('1760000000000_1.0-beta-2');
        expect(isValidBackupId('1760000000000_1.2.3')).toBe(true);
        expect(isValidBackupId('1760000000000_../x')).toBe(false);
        expect(isValidBackupId('123_1.0')).toBe(false);
        expect(isValidBackupId('.partial-1760000000000_1.0')).toBe(false);
    });
});


describe('path containment', () => {
    const data = path.resolve(os.tmpdir(), 'server-data');

    it('only accepts paths strictly inside the parent', () => {
        expect(isPathInside(data, path.join(data, 'resources', 'a'))).toBe(true);
        expect(isPathInside(data, data)).toBe(false);
        expect(isPathInside(data, path.join(data, '..', 'other'))).toBe(false);
        expect(isPathInside(data, `${data}-evil${path.sep}resources`)).toBe(false);
        expect(isPathInside(data, path.join(data, '..data', 'x'))).toBe(true);
    });

    it('checks raw resource paths', () => {
        expect(checkResourceFolder(path.join(data, 'resources', '[local]', 'shop'), data))
            .toEqual({ ok: true, folder: path.join(data, 'resources', '[local]', 'shop') });
        expect(checkResourceFolder(`${data}/resources/../../etc`, data)).toEqual({ ok: false, reason: 'outside_data' });
        expect(checkResourceFolder(data, data)).toEqual({ ok: false, reason: 'outside_data' });
        expect(checkResourceFolder(path.join(data, 'system_resources', 'chat'), data)).toEqual({ ok: false, reason: 'system_resource' });
        expect(checkResourceFolder('resources/shop', data)).toEqual({ ok: false, reason: 'not_absolute' });
        expect(checkResourceFolder('', data)).toEqual({ ok: false, reason: 'not_absolute' });
        expect(checkResourceFolder(path.join(data, 'resources', 'shop'), null)).toEqual({ ok: false, reason: 'no_data_path' });
    });

    it('never allows the monitor or system resources to be replaced', () => {
        expect(isResourceReplaceable({ name: 'shop', path: path.join(data, 'resources', 'shop') }, data)).toBe(true);
        expect(isResourceReplaceable({ name: 'monitor', path: path.join(data, 'resources', 'monitor') }, data)).toBe(false);
        expect(isResourceReplaceable({ name: 'chat', path: path.join(os.tmpdir(), 'citizen', 'system_resources', 'chat') }, data)).toBe(false);
        expect(isResourceReplaceable({ name: 'elsewhere', path: path.join(os.tmpdir(), 'elsewhere') }, data)).toBe(false);
    });

    it('resolves the real folder and repeats the checks', async () => {
        const data = newDir('server-data');
        const resource = path.join(data, 'resources', 'shop');
        writeFile(path.join(resource, 'fxmanifest.lua'));
        const noManifest = path.join(data, 'resources', 'empty');
        fs.mkdirSync(noManifest, { recursive: true });
        const outside = newDir('outside-res');
        writeFile(path.join(outside, 'fxmanifest.lua'));
        const linked = path.join(data, 'resources', 'linked');
        fs.symlinkSync(outside, linked, 'junction');

        expect(await resolveRealResourceFolder(resource, data)).toBe(fs.realpathSync.native(resource));
        expect(await resolveRealResourceFolder(noManifest, data)).toBeUndefined();
        expect(await resolveRealResourceFolder(path.join(data, 'resources', 'missing'), data)).toBeUndefined();
        expect(await resolveRealResourceFolder(linked, data)).toBeUndefined();
    });
});


describe('findManifestRoot', () => {
    it('finds a manifest at the top level', async () => {
        const base = newDir('extract');
        writeFile(path.join(base, 'fxmanifest.lua'));
        writeFile(path.join(base, 'nested', 'fxmanifest.lua'));
        expect(await findManifestRoot(base, 'res')).toEqual({ ok: true, root: base });
    });

    it('finds a zipball-style nested manifest and accepts __resource.lua', async () => {
        const base = newDir('extract');
        writeFile(path.join(base, 'owner-repo-abc123', '__resource.lua'));
        expect(await findManifestRoot(base, 'res')).toEqual({ ok: true, root: path.join(base, 'owner-repo-abc123') });
    });

    it('searches at most three levels deep', async () => {
        const atThree = newDir('extract');
        writeFile(path.join(atThree, 'a', 'b', 'c', 'fxmanifest.lua'));
        expect(await findManifestRoot(atThree, 'res')).toEqual({ ok: true, root: path.join(atThree, 'a', 'b', 'c') });

        const atFour = newDir('extract');
        writeFile(path.join(atFour, 'a', 'b', 'c', 'd', 'fxmanifest.lua'));
        expect(await findManifestRoot(atFour, 'res')).toEqual({ ok: false, reason: 'not_found' });
    });

    it('picks the folder named like the resource when a level holds several', async () => {
        const base = newDir('extract');
        writeFile(path.join(base, 'bundle', 'other', 'fxmanifest.lua'));
        writeFile(path.join(base, 'bundle', 'My_Res', 'fxmanifest.lua'));
        expect(await findManifestRoot(base, 'my_res')).toEqual({ ok: true, root: path.join(base, 'bundle', 'My_Res') });
        expect(await findManifestRoot(base, 'unrelated')).toEqual({ ok: false, reason: 'ambiguous' });
    });

    it('ignores macOS metadata folders and reports a missing manifest', async () => {
        const base = newDir('extract');
        writeFile(path.join(base, '__MACOSX', 'fxmanifest.lua'));
        writeFile(path.join(base, 'res', 'README.md'));
        expect(await findManifestRoot(base, 'res')).toEqual({ ok: false, reason: 'not_found' });
    });
});


describe('backups', () => {
    it('creates, lists and prunes backups', async () => {
        const root = newDir('backups');
        const source = newDir('source');
        writeFile(path.join(source, 'fxmanifest.lua'), 'version "1.0.0"');
        writeFile(path.join(source, 'client', 'main.lua'), 'print(1)');

        const ids: string[] = [];
        for (let i = 0; i < 7; i++) {
            ids.push(await createBackup(root, 'shop', source, `1.0.${i}`, 1760000000000 + i * 1000));
        }
        //Same timestamp: the id moves forward instead of overwriting
        const sameTs = await createBackup(root, 'shop', source, '1.0.6', 1760000006000);
        expect(sameTs).toBe('1760000006001_1.0.6');

        fs.mkdirSync(path.join(root, 'shop', 'junk'));
        fs.mkdirSync(path.join(root, 'shop', '.partial-1760000009000_1.0.9'));
        const listed = await listBackups(root, 'shop');
        expect(listed).toHaveLength(8);
        expect(listed[0]).toEqual({ id: '1760000006001_1.0.6', version: '1.0.6', createdAt: 1760000006001 });
        expect(fs.readFileSync(path.join(root, 'shop', ids[0], 'client', 'main.lua'), 'utf8')).toBe('print(1)');

        const removed = await pruneBackups(root, 'shop', 5);
        expect(removed).toEqual([ids[2], ids[1], ids[0]]);
        const remaining = await listBackups(root, 'shop');
        expect(remaining.map((backup) => backup.id)).toEqual([sameTs, ids[6], ids[5], ids[4], ids[3]]);
        expect(fs.existsSync(path.join(root, 'shop', 'junk'))).toBe(true);

        const all = await listAllBackups(root);
        expect([...all.keys()]).toEqual(['shop']);
        expect(await listBackups(root, 'missing')).toEqual([]);
        expect(await listBackups(root, '..')).toEqual([]);
    });
});


describe('replaceFolder', () => {
    it('swaps the folder and cleans up its siblings', async () => {
        const parent = newDir('resources');
        const target = path.join(parent, 'shop');
        writeFile(path.join(target, 'fxmanifest.lua'), 'old');
        writeFile(path.join(target, 'old-only.lua'), 'old');
        const source = newDir('new-files');
        writeFile(path.join(source, 'fxmanifest.lua'), 'new');
        //Leftovers from an interrupted swap must not break the next one
        writeFile(path.join(`${target}.cadmin-new`, 'stale.lua'));

        expect(await replaceFolder(target, source)).toEqual({});
        expect(fs.readFileSync(path.join(target, 'fxmanifest.lua'), 'utf8')).toBe('new');
        expect(fs.existsSync(path.join(target, 'old-only.lua'))).toBe(false);
        expect(fs.existsSync(`${target}.cadmin-new`)).toBe(false);
        expect(fs.existsSync(`${target}.cadmin-old`)).toBe(false);
        expect(fs.existsSync(path.join(source, 'fxmanifest.lua'))).toBe(true);
    });

    it('leaves the original folder in place when staging fails', async () => {
        const parent = newDir('resources');
        const target = path.join(parent, 'shop');
        writeFile(path.join(target, 'fxmanifest.lua'), 'old');

        const failure = await replaceFolder(target, path.join(parent, 'does-not-exist')).catch((error) => error);
        expect(failure).toBeInstanceOf(FolderSwapError);
        expect(failure.restored).toBe(true);
        expect(fs.readFileSync(path.join(target, 'fxmanifest.lua'), 'utf8')).toBe('old');
        expect(fs.existsSync(`${target}.cadmin-new`)).toBe(false);
    });

    it('refuses a missing target', async () => {
        const parent = newDir('resources');
        const source = newDir('new-files');
        await expect(replaceFolder(path.join(parent, 'missing'), source)).rejects.toBeInstanceOf(FolderSwapError);
    });
});
