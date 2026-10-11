import path from 'node:path';

/**
 * File layout of an extracted FXServer build.
 * - Windows (`server.zip`): FXServer.exe and citizen/ at the root.
 * - Linux (`fx.tar.xz`): alpine/ at the root, the server in alpine/opt/cfx-server/.
 * `fxsPath` matches what `txEnv.fxsPath` is for the host build, so FxRunner can build the
 * spawn variables for both the same way.
 */

export const MARKER_FILE_NAME = '.cadmin-build.json';

export type BuildLayout = {
    dir: string;
    fxsPath: string;
    binPath: string;
    loaderPath: string | null;
    citizenPath: string;
    monitorPath: string;
    markerPath: string;
};

export const getBuildLayout = (dir: string, isWindows: boolean): BuildLayout => {
    const fxsPath = isWindows
        ? dir
        : path.join(dir, 'alpine', 'opt', 'cfx-server');
    const citizenPath = path.join(fxsPath, 'citizen');
    return {
        dir,
        fxsPath,
        binPath: path.join(fxsPath, isWindows ? 'FXServer.exe' : 'FXServer'),
        loaderPath: isWindows ? null : path.join(fxsPath, 'ld-musl-x86_64.so.1'),
        citizenPath,
        monitorPath: path.join(citizenPath, 'system_resources', 'monitor'),
        markerPath: path.join(dir, MARKER_FILE_NAME),
    };
};


/**
 * True when one path is the other or contains it. Used to make sure a monitor copy can
 * never delete or recurse into the panel's own resource folder.
 */
export const pathsOverlap = (a: string, b: string) => {
    const normalize = (p: string) => {
        const resolved = path.resolve(p);
        return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return true;
    const withSep = (p: string) => p.endsWith(path.sep) ? p : p + path.sep;
    return na.startsWith(withSep(nb)) || nb.startsWith(withSep(na));
};
