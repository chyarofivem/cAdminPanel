import path from 'node:path';
import slash from 'slash';
import { describe, expect, it } from 'vitest';
import { buildOsSpawnVars } from '@modules/FxRunner/utils';
import { getBuildLayout } from './layout';

/**
 * FxBuilds hands FxRunner `slash(path.normalize(layout.fxsPath))`, the same cleanup
 * globalData applies to the host's citizen_root.
 */
const managedFxsPath = (dir: string, isWindows: boolean) => {
    return slash(path.normalize(getBuildLayout(dir, isWindows).fxsPath));
};


describe('spawn variables for a managed build', () => {
    it('runs FXServer.exe from the build folder on Windows', () => {
        const fxsPath = managedFxsPath('C:/txData/fxserver-builds/13000', true);
        expect(buildOsSpawnVars(true, fxsPath)).toEqual({
            bin: 'C:/txData/fxserver-builds/13000/FXServer.exe',
            args: [],
        });
    });

    it('runs the build through its own ld-musl loader on Linux', () => {
        const fxsPath = managedFxsPath('/home/fx/txData/fxserver-builds/13000', false);
        expect(fxsPath).toBe('/home/fx/txData/fxserver-builds/13000/alpine/opt/cfx-server');
        const alpine = '/home/fx/txData/fxserver-builds/13000/alpine';
        expect(buildOsSpawnVars(false, fxsPath)).toEqual({
            bin: `${alpine}/opt/cfx-server/ld-musl-x86_64.so.1`,
            args: [
                '--library-path', `${alpine}/usr/lib/v8/:${alpine}/lib/:${alpine}/usr/lib/`,
                '--',
                `${alpine}/opt/cfx-server/FXServer`,
                '+set', 'citizen_dir', `${alpine}/opt/cfx-server/citizen/`,
            ],
        });
    });

    it('builds the same shape as the host build', () => {
        //The host citizen_root on Linux is alpine/opt/cfx-server/, with a trailing slash
        const host = buildOsSpawnVars(false, '/opt/fx/alpine/opt/cfx-server/');
        expect(host.bin).toBe('/opt/fx/alpine/opt/cfx-server/ld-musl-x86_64.so.1');
        expect(host.args[host.args.length - 1]).toBe('/opt/fx/alpine/opt/cfx-server/citizen/');
        expect(buildOsSpawnVars(true, 'D:/fxserver').bin).toBe('D:/fxserver/FXServer.exe');
    });
});


describe('getBuildLayout', () => {
    it('places the monitor resource inside the build', () => {
        const win = getBuildLayout(path.join('root', '13000'), true);
        expect(slash(win.binPath)).toBe('root/13000/FXServer.exe');
        expect(win.loaderPath).toBeNull();
        expect(slash(win.monitorPath)).toBe('root/13000/citizen/system_resources/monitor');
        expect(slash(win.markerPath)).toBe('root/13000/.cadmin-build.json');

        const lin = getBuildLayout(path.join('root', '13000'), false);
        expect(slash(lin.binPath)).toBe('root/13000/alpine/opt/cfx-server/FXServer');
        expect(slash(lin.loaderPath!)).toBe('root/13000/alpine/opt/cfx-server/ld-musl-x86_64.so.1');
        expect(slash(lin.monitorPath)).toBe('root/13000/alpine/opt/cfx-server/citizen/system_resources/monitor');
        expect(slash(lin.markerPath)).toBe('root/13000/.cadmin-build.json');
    });
});
