import { getVersionDiff, parseVersion } from '@modules/UpdateChecker/versionCompare';

export type VersionComparison = 'newer' | 'same' | 'older' | 'unknown';

/**
 * Strips whitespace and a leading `v` from a release tag or manifest version.
 */
export const normalizeVersionTag = (raw: unknown) => {
    if (typeof raw !== 'string') return '';
    return raw.trim().replace(/^v(?=\d)/i, '');
};

type LooseVersion = {
    parts: number[];
    prerelease?: string;
};

//Resource manifests use anything from `1` to `1.2.3.4`, so this is looser than semver
const looseVersionRegex = /^(\d{1,9}(?:\.\d{1,9}){0,3})(?:-([0-9A-Za-z.-]{1,50}))?$/;

const parseLooseVersion = (raw: string): LooseVersion | undefined => {
    const match = looseVersionRegex.exec(raw.split('+')[0]);
    if (!match) return;
    return {
        parts: match[1].split('.').map((part) => parseInt(part, 10)),
        prerelease: match[2],
    };
};

const compareLoose = (current: LooseVersion, latest: LooseVersion): VersionComparison => {
    const length = Math.max(current.parts.length, latest.parts.length);
    for (let i = 0; i < length; i++) {
        const a = current.parts[i] ?? 0;
        const b = latest.parts[i] ?? 0;
        if (a !== b) return b > a ? 'newer' : 'older';
    }
    if (current.prerelease === latest.prerelease) return 'same';
    if (!latest.prerelease) return 'newer';
    if (!current.prerelease) return 'older';
    const order = current.prerelease.localeCompare(latest.prerelease, 'en', { numeric: true });
    return order < 0 ? 'newer' : 'older';
};


/**
 * Compares a resource's local version with a release tag.
 * Strict x.y.z versions go through the panel's own update checker helpers; anything else
 * with one to four numeric parts is compared part by part. Text that is not a version
 * (an empty value, `latest`, a date stamp with words) is 'unknown'.
 */
export const compareResourceVersions = (current: unknown, latest: unknown): VersionComparison => {
    const currentClean = normalizeVersionTag(current);
    const latestClean = normalizeVersionTag(latest);
    if (!currentClean || !latestClean) return 'unknown';

    if (parseVersion(currentClean) && parseVersion(latestClean)) {
        if (getVersionDiff(currentClean, latestClean)) return 'newer';
        if (getVersionDiff(latestClean, currentClean)) return 'older';
        return 'same';
    }

    const currentLoose = parseLooseVersion(currentClean);
    const latestLoose = parseLooseVersion(latestClean);
    if (!currentLoose || !latestLoose) {
        return currentClean.toLowerCase() === latestClean.toLowerCase() ? 'same' : 'unknown';
    }
    return compareLoose(currentLoose, latestLoose);
};
