/**
 * Centralized storage key list for better organization.
 */
export enum LocalStorageKey {
    // Prefixes-only
    // ImgCache = 'txa:imgCache:', //NOTE: not yet used
    NewFeatureSeenTs = 'txa:newFeat:seenTs:',

    // static
    ErrorFallbackLastReload = 'txa:errorFallback:lastReload',
    UpdateWarningPostponedTs = 'txa:updateWarning:postponedTs',
    PlayersPageSearchType = 'txa:playersPage:searchType',
    AuthCredsAutofill = 'txa:authCreds:autofill',

    // atomWithStorage
    LiveConsoleBookmarks = 'txa:liveConsole:bookmarks',
    LiveConsoleHistory = 'txa:liveConsole:history',
    LiveConsoleOptions = 'txa:liveConsole:options',
}


/**
 * Creates a Jotai-compatible storage for arbitrary values.
 * Check how it's used in the LiveConsole hooks.
 */
export const createValidatedStorage = <T>(validator: (value: unknown) => T, defaultValue: T) => {
    return {
        getItem: (key: string): T => {
            const storedValue = localStorage.getItem(key);
            if (!storedValue) return defaultValue;
            try {
                const parsedValue = JSON.parse(storedValue);
                return validator(parsedValue);
            } catch (error) {
                return defaultValue;
            }
        },
        setItem: (key: string, value: T): void => {
            const validatedValue = validator(value);
            localStorage.setItem(key, JSON.stringify(validatedValue));
        },
        removeItem: (key: string): void => {
            localStorage.removeItem(key);
        },
    };
};


/**
 * Ensures that the value is an array of strings.
 */
export const validateStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
};
