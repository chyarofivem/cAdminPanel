import { expect, it, suite } from 'vitest';
import { getVersionDiff, isVersionNewer, parseVersion } from './versionCompare';


suite('parseVersion', () => {
    it('should parse a plain version', () => {
        expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: undefined });
    });
    it('should tolerate a leading v and surrounding whitespace', () => {
        expect(parseVersion(' v10.0.4 ')).toEqual({ major: 10, minor: 0, patch: 4, prerelease: undefined });
    });
    it('should parse a pre-release', () => {
        expect(parseVersion('1.0.0-beta.2')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: 'beta.2' });
    });
    it('should ignore build metadata', () => {
        expect(parseVersion('1.0.0+build.9')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: undefined });
    });
    it('should reject malformed values', () => {
        expect(parseVersion('1.2')).toBeUndefined();
        expect(parseVersion('1.2.3.4')).toBeUndefined();
        expect(parseVersion('latest')).toBeUndefined();
        expect(parseVersion('')).toBeUndefined();
        expect(parseVersion(undefined)).toBeUndefined();
        expect(parseVersion(123)).toBeUndefined();
    });
});


suite('getVersionDiff', () => {
    it('should detect a major update', () => {
        expect(getVersionDiff('1.2.3', '2.0.0')).toBe('major');
    });
    it('should detect a minor update', () => {
        expect(getVersionDiff('1.2.3', '1.3.0')).toBe('minor');
    });
    it('should detect a patch update', () => {
        expect(getVersionDiff('1.2.3', '1.2.4')).toBe('patch');
    });
    it('should detect the stable release of the running pre-release', () => {
        expect(getVersionDiff('1.0.0-beta.1', '1.0.0')).toBe('prerelease');
    });
    it('should compare numerically instead of lexically', () => {
        expect(getVersionDiff('1.9.0', '1.10.0')).toBe('minor');
        expect(getVersionDiff('1.0.9', '1.0.10')).toBe('patch');
    });
    it('should return undefined for the same version', () => {
        expect(getVersionDiff('1.2.3', '1.2.3')).toBeUndefined();
        expect(getVersionDiff('1.2.3', 'v1.2.3')).toBeUndefined();
    });
    it('should return undefined when the candidate is older', () => {
        expect(getVersionDiff('2.0.0', '1.9.9')).toBeUndefined();
        expect(getVersionDiff('1.2.3', '1.2.2')).toBeUndefined();
        expect(getVersionDiff('1.0.0', '1.0.0-beta.1')).toBeUndefined();
    });
    it('should prioritize the highest differing part', () => {
        expect(getVersionDiff('1.9.9', '2.0.0')).toBe('major');
        expect(getVersionDiff('2.0.0', '1.99.99')).toBeUndefined();
    });
    it('should return undefined for unparseable input', () => {
        expect(getVersionDiff('0.0.0', 'nightly')).toBeUndefined();
        expect(getVersionDiff(undefined, '1.0.0')).toBeUndefined();
    });
});


suite('isVersionNewer', () => {
    it('should be true only when there is an update', () => {
        expect(isVersionNewer('1.0.0', '1.0.1')).toBe(true);
        expect(isVersionNewer('1.0.0', '1.0.0')).toBe(false);
        expect(isVersionNewer('1.0.1', '1.0.0')).toBe(false);
    });
});
