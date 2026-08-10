import consts from '@shared/consts';

export enum LogoutReasonHash {
    NONE = '',
    LOGOUT = '#logout',
    EXPIRED = '#expired',
    UPDATED = '#updated',
    MASTER_ALREADY_SET = '#master_already_set',
    SHUTDOWN = '#shutdown',
}


/**
 * Validates if a redirect path is valid or not.
 * To prevent open redirect, we need to make sure the first char is / and the second is not,
 * otherwise //example.com would be a valid redirect to <proto>://example.com
 */
export function isValidRedirectPath(location: unknown): location is string {
    if (typeof location !== 'string' || !location) return false;
    if (!location.startsWith('/') || location.startsWith('//')) return false;

    try {
        const currentUrl = new URL(window.location.href);
        const redirectUrl = new URL(location, currentUrl);
        return redirectUrl.origin === currentUrl.origin;
    } catch {
        return false;
    }
}


/** Resolves an internal panel route through WebPipe when running inside NUI. */
export function getPanelLocation(location: string) {
    if (!isValidRedirectPath(location)) throw new Error('Invalid internal panel location.');

    const currentUrl = new URL(window.location.href);
    const internalUrl = new URL(location, currentUrl);
    const normalizedLocation = `${internalUrl.pathname}${internalUrl.search}${internalUrl.hash}`;
    if (window.txConsts.isWebInterface) return normalizedLocation;

    const webpipeBase = new URL(consts.nuiWebpipePath);
    const webpipeUrl = new URL(normalizedLocation.slice(1), webpipeBase);
    const webpipePath = webpipeBase.pathname.endsWith('/')
        ? webpipeBase.pathname
        : `${webpipeBase.pathname}/`;
    if (webpipeUrl.origin !== webpipeBase.origin || !webpipeUrl.pathname.startsWith(webpipePath)) {
        throw new Error('Invalid internal panel location.');
    }
    return webpipeUrl.toString();
}


/** Performs a full internal navigation without escaping the NUI WebPipe. */
export function navigatePanel(location: string) {
    window.location.assign(getPanelLocation(location));
}


/** Reloads the current route through the correct web or NUI entry point. */
export function reloadPanel() {
    if (window.txConsts.isWebInterface) {
        window.location.reload();
        return;
    }

    const currentUrl = new URL(window.location.href);
    const webpipeBase = new URL(consts.nuiWebpipePath);
    const webpipeRoot = webpipeBase.pathname.replace(/\/$/, '');
    let panelPath = currentUrl.pathname;
    if (currentUrl.origin === webpipeBase.origin) {
        if (currentUrl.pathname === webpipeRoot) {
            panelPath = '/';
        } else if (currentUrl.pathname.startsWith(`${webpipeRoot}/`)) {
            panelPath = currentUrl.pathname.slice(webpipeRoot.length);
        }
    }
    navigatePanel(panelPath + currentUrl.search + currentUrl.hash);
}


/**
 * Returns the path/search/hash of the login URL with redirect params
 * /aaa/bbb?ccc=ddd#eee -> /login?r=%2Faaa%2Fbbb%3Fccc%3Dddd%23eee
 */
export function redirectToLogin(reasonHash = LogoutReasonHash.NONE) {
    const currLocation = window.location.pathname + window.location.search + window.location.hash;
    const newLocation = currLocation === '/' || currLocation.startsWith('/login')
        ? `/login${reasonHash}`
        : `/login?r=${encodeURIComponent(currLocation)}${reasonHash}`;
    window.history.replaceState(null, '', newLocation);
}


/**
 * Opens a link in a new tab, or calls the native function to open a link in the default browser
 */
export const openExternalLink = (url: string) => {
    if (!url) return;
    if (window.invokeNative) {
        window.invokeNative('openUrl', url);
    } else {
        window.open(url, '_blank');
    }
}


/**
 * Overwrites the href behavior in NUI to open external links
 */
export const handleExternalLinkClick = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (window.txConsts.isWebInterface) return;
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;

    event.preventDefault();
    openExternalLink(href);
}


/**
 * Sets the window URL search param with a given value, or deletes it if value is undefined
 */
export const setUrlSearchParam = (paramName: string, value: string | undefined) => {
    if (typeof paramName !== 'string' || !paramName.length) {
        throw new Error(`setUrlSearchParam: paramName must be a non-empty string`);
    }
    const pageUrl = new URL(window.location.toString());
    if (value) {
        pageUrl.searchParams.set(paramName, value);
    } else {
        pageUrl.searchParams.delete(paramName);
    }
    window.history.replaceState({}, '', pageUrl);
}


/**
 * Gets the window URL search param with a given name
 */
export const getUrlSearchParam = (paramName: string) => {
    if (typeof paramName !== 'string' || !paramName.length) {
        throw new Error(`getUrlSearchParam: paramName must be a non-empty string`);
    }
    const pageUrl = new URL(window.location.toString());
    return pageUrl.searchParams.get(paramName);
}


/**
 * Sets the window URL hash to a given value, or deletes it if value is undefined
 */
export const setUrlHash = (hash: string | undefined) => {
    const pageUrl = new URL(window.location.href);
    if (hash) {
        pageUrl.hash = hash;
    } else {
        pageUrl.hash = '';
    }
    window.history.replaceState(null, '', pageUrl.toString());
}
