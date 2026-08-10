/*
 * Copyright (c) chyarogroup 2026
 */

import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { txEnv } from '@core/globalData';
import { accentVars, resolveAccent } from './theme';

export const BRANDING_KINDS = ['logo', 'favicon', 'banner'] as const;
export type BrandingKind = typeof BRANDING_KINDS[number];

const MAX_UPLOAD_BYTES = 128 * 1024;
const brandingDir = path.join(txEnv.profilePath, 'data', 'branding');
const storedFilenameRegex = /^[a-f0-9]{64}\.(?:png|jpg|gif|webp|ico)$/;

const kindConfigKeys = {
    logo: 'logoUrl',
    favicon: 'faviconUrl',
    banner: 'bannerUrl',
} as const;

type SniffedImage = { mime: string; extension: 'png' | 'jpg' | 'gif' | 'webp' | 'ico' };

function sniffImage(data: Buffer): SniffedImage | undefined {
    if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { mime: 'image/png', extension: 'png' };
    }
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
        return { mime: 'image/jpeg', extension: 'jpg' };
    }
    if (data.length >= 6 && ['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii'))) {
        return { mime: 'image/gif', extension: 'gif' };
    }
    if (data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { mime: 'image/webp', extension: 'webp' };
    }
    if (data.length >= 4 && data[0] === 0 && data[1] === 0 && data[2] === 1 && data[3] === 0) {
        return { mime: 'image/x-icon', extension: 'ico' };
    }
}

export function isStoredBrandingFilename(value: unknown): value is string {
    return typeof value === 'string' && storedFilenameRegex.test(value);
}

export async function storeBrandingDataUrl(kind: BrandingKind, value: string) {
    if (!BRANDING_KINDS.includes(kind)) throw new Error('Invalid branding asset kind.');
    const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(value);
    if (!match) throw new Error('Branding uploads must be base64 data URLs.');
    if (match[1].toLowerCase().includes('svg')) throw new Error('SVG uploads are not supported. Please use PNG, JPEG, GIF, WebP, or ICO.');

    const data = Buffer.from(match[2], 'base64');
    if (!data.length) throw new Error('The uploaded image is empty.');
    if (data.length > MAX_UPLOAD_BYTES) throw new Error('The uploaded image exceeds the 128 KB limit.');

    const sniffed = sniffImage(data);
    if (!sniffed) throw new Error('The uploaded file is not a supported image.');
    const declaredMime = match[1].toLowerCase();
    const compatibleMime = declaredMime === sniffed.mime
        || (sniffed.extension === 'ico' && ['image/vnd.microsoft.icon', 'image/ico'].includes(declaredMime));
    if (!compatibleMime) throw new Error('The uploaded file contents do not match its declared image type.');

    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const filename = `${hash}.${sniffed.extension}`;
    await fsp.mkdir(brandingDir, { recursive: true });
    try {
        await fsp.writeFile(path.join(brandingDir, filename), data, { flag: 'wx' });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    return filename;
}

export function panelDisplayName(serverName = txConfig.general.serverName) {
    const normalizedName = typeof serverName === 'string' ? serverName.trim() : '';
    return `${!normalizedName || normalizedName === 'change-me' ? 'FiveM' : normalizedName} Panel`;
}

function configuredFilename(kind: BrandingKind) {
    return txConfig.general[kindConfigKeys[kind]];
}

export function brandingUrl(kind: BrandingKind, forceDefault = false, basePath = '/') {
    const filename = forceDefault ? '' : configuredFilename(kind);
    const fallbackVersion = crypto.createHash('sha256')
        .update(`${resolveAccent(txConfig.general.accent)}:${panelDisplayName()}`)
        .digest('hex')
        .slice(0, 12);
    const version = filename || fallbackVersion;
    const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    return `${normalizedBasePath}branding/${kind}?v=${encodeURIComponent(version)}${forceDefault ? '&default=1' : ''}`;
}

export function brandingViewLocals(basePath = '/') {
    return {
        panelName: panelDisplayName(),
        accent: resolveAccent(txConfig.general.accent),
        logoUrl: brandingUrl('logo', false, basePath),
        faviconUrl: brandingUrl('favicon', false, basePath),
        bannerUrl: brandingUrl('banner', false, basePath),
    };
}

function defaultMark(kind: BrandingKind) {
    const vars = accentVars(txConfig.general.accent);
    const wide = kind === 'banner';
    const width = wide ? 420 : 128;
    const label = panelDisplayName()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 128" role="img" aria-label="${label}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="rgb(${vars['brand-500']})"/><stop offset="1" stop-color="rgb(${vars['brand-700']})"/></linearGradient></defs>
<rect width="${width}" height="128" rx="24" fill="url(#g)"/><path d="M31 35h66v18H55v11h36v17H55v12h42v18H31z" fill="white"/>
${wide ? `<text x="118" y="79" fill="white" font-family="system-ui,sans-serif" font-size="31" font-weight="700">${label}</text>` : ''}</svg>`);
}

export type BrandingAsset = { body: Buffer; mime: string; isFallback: boolean };

export async function readBrandingAsset(kind: BrandingKind, forceDefault = false): Promise<BrandingAsset> {
    const filename = forceDefault ? '' : configuredFilename(kind);
    if (isStoredBrandingFilename(filename)) {
        try {
            const body = await fsp.readFile(path.join(brandingDir, filename));
            const sniffed = sniffImage(body);
            if (sniffed) return { body, mime: sniffed.mime, isFallback: false };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
    return { body: defaultMark(kind), mime: 'image/svg+xml', isFallback: true };
}

export async function pruneUnusedBrandingFiles() {
    const used = new Set(BRANDING_KINDS.map(configuredFilename).filter(isStoredBrandingFilename));
    let entries;
    try {
        entries = await fsp.readdir(brandingDir, { withFileTypes: true });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
    }
    await Promise.all(entries
        .filter(entry => entry.isFile() && isStoredBrandingFilename(entry.name) && !used.has(entry.name))
        .map(entry => fsp.unlink(path.join(brandingDir, entry.name))));
}
