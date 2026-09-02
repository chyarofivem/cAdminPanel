import fs from 'node:fs';
import path from 'node:path';
import { SemVer } from 'semver';
import config from './config';


/**
 * cAdminPanel + license banner for bundled files
 */
export const licenseBanner = (baseDir = '.', isBundledFile = false) => {
    const licensePath = path.join(baseDir, 'LICENSE');
    const rootPrefix = isBundledFile ? '../' : '';
    const lineSep = '%'.repeat(80);
    const titlePad = ' '.repeat(18);
    const contentLines = [
        lineSep,
        titlePad + 'cAdminPanel - FiveM/RedM server management',
        titlePad + 'https://github.com/chyarofivem/cAdminPanel',
        lineSep,
        'cAdminPanel is free open source software provided under the license below.',
        lineSep,
        ...fs.readFileSync(licensePath, 'utf8').trim().split('\n'),
        lineSep,
        'This distribution also includes third party code under their own licenses, which',
        `can be found in ${rootPrefix}THIRD-PARTY-LICENSES.txt or their respective repositories.`,
        `Attribution for non-code assets can be found at the bottom of ${rootPrefix}README.md or at`,
        'the top of the respective file.',
        lineSep,
    ];
    if (isBundledFile) {
        const flattened = contentLines.join('\n * ');
        return `/*!\n * ${flattened}\n */`;
    } else {
        return contentLines.join('\n');
    }
};


/**
 * Processes a fxserver path to validate it as well as the monitor folder.
 * NOTE: this function is windows only, but could be easily adapted.
 */
export const getFxsPaths = (fxserverPath: string) => {
    const root = path.normalize(fxserverPath);

    //Process fxserver path
    const bin = path.join(root, 'FXServer.exe');
    const binStat = fs.statSync(bin);
    if (!binStat.isFile()) {
        throw new Error(`${bin} is not a file.`);
    }

    //Process monitor path
    const monitor = path.join(root, 'citizen', 'system_resources', 'monitor');
    const monitorStat = fs.statSync(monitor);
    if (!monitorStat.isDirectory()) {
        throw new Error(`${monitor} is not a directory.`);
    }

    return { root, bin, monitor };
};


/**
 * Extracts the version from the GITHUB_REF env var and detects if pre-release
 * NOTE: to run locally: `GITHUB_REF="refs/tags/v9.9.9" npm run build`
 */
export const getPublishVersion = (isOptional: boolean) => {
    const workflowRef = process.env.GITHUB_REF;
    try {
        if (!workflowRef) {
            if (isOptional) {
                return {
                    txVersion: '1.0.0-dev',
                    isPreRelease: false,
                    preReleaseExpiration: '0',
                };
            } else {
                throw new Error('No --tag found.');
            }
        }
        const refRemoved = workflowRef.replace(/^(refs\/tags\/)?v/, '');
        const parsedVersion = new SemVer(refRemoved);
        const isPreRelease = parsedVersion.prerelease.length > 0;
        const potentialExpiration = new Date().setUTCHours(24 * config.preReleaseExpirationDays, 0, 0, 0);
        console.log(`cAdminPanel version ${parsedVersion.version}.`);
        return {
            txVersion: parsedVersion.version,
            isPreRelease,
            preReleaseExpiration: isPreRelease ? potentialExpiration.toString() : '0',
        };
    } catch (error) {
        console.error('Version setup failed: ' + error.message);
        process.exit(1);
    }
};


/**
 * Edits the ./dist/fxmanifest.lua to include the panel version.
 * TODO: set up *_scripts automagically
 */
const setupDistFxmanifest = (targetPath: string, txVersion: string) => {
    // console.log('[BUILDER] Setting up fxmanifest.lua: ' + txVersion);
    const fxManifestPath = path.join(targetPath, 'fxmanifest.lua');
    let fxManifestContent = fs.readFileSync(fxManifestPath, 'utf8');
    fxManifestContent = fxManifestContent.replace(/^version 'REPLACE-VERSION'$/m, `version '${txVersion}'`);
    fs.writeFileSync(fxManifestPath, fxManifestContent);
};


/**
 * Sync the files from local path to target path.
 * This function tried to remove the files before copying new ones,
 * therefore, first make sure the path is correct.
 * NOTE: each change, it resets the entire target path.
 */
export const copyStaticFiles = (targetPath: string, txVersion: string, eventName: string) => {
    console.log(`[COPIER][${eventName}] Syncing ${targetPath}.`);
    for (const srcPath of config.copy) {
        const destPath = path.join(targetPath, srcPath);
        fs.rmSync(destPath, { recursive: true, force: true });
        fs.cpSync(srcPath, destPath, { recursive: true });
    }
    setupDistFxmanifest(targetPath, txVersion);
};
