/**
 * Minimal semver comparison for the update checker.
 * The full semver package is not a dependency, and the only comparison needed here is
 * "is this release newer than what is running", where the candidate always comes from
 * GitHub's /releases/latest and is therefore never a pre-release.
 */

export type ParsedVersion = {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
};

/**
 * How a newer version differs from the running one.
 * 'prerelease' means the same x.y.z, but the running version is a pre-release of it.
 */
export type VersionDiffType = 'major' | 'minor' | 'patch' | 'prerelease';

const versionRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9a-z.-]+))?$/i;


/**
 * Parses a version string, tolerating a leading `v` and ignoring build metadata.
 */
export const parseVersion = (raw: unknown): ParsedVersion | undefined => {
    if (typeof raw !== 'string') return;
    const cleaned = raw.trim().replace(/^v/i, '').split('+')[0];
    const match = versionRegex.exec(cleaned);
    if (!match) return;
    const parsed = {
        major: parseInt(match[1]),
        minor: parseInt(match[2]),
        patch: parseInt(match[3]),
        prerelease: match[4],
    } satisfies ParsedVersion;
    if (isNaN(parsed.major) || isNaN(parsed.minor) || isNaN(parsed.patch)) return;
    return parsed;
};


/**
 * Returns how `candidate` is newer than `current`, or undefined when it is not newer
 * or when either version cannot be parsed.
 */
export const getVersionDiff = (current: unknown, candidate: unknown): VersionDiffType | undefined => {
    const running = parseVersion(current);
    const latest = parseVersion(candidate);
    if (!running || !latest) return;

    if (latest.major !== running.major) {
        return latest.major > running.major ? 'major' : undefined;
    }
    if (latest.minor !== running.minor) {
        return latest.minor > running.minor ? 'minor' : undefined;
    }
    if (latest.patch !== running.patch) {
        return latest.patch > running.patch ? 'patch' : undefined;
    }

    //Same x.y.z: a pre-release is older than the stable release it leads to.
    //Two pre-releases of the same version are treated as equal, since the candidate
    //is always a stable release and ordering identifiers is not needed.
    if (running.prerelease && !latest.prerelease) return 'prerelease';
    return;
};


/**
 * Whether `candidate` is a newer version than `current`.
 */
export const isVersionNewer = (current: unknown, candidate: unknown) => {
    return getVersionDiff(current, candidate) !== undefined;
};
