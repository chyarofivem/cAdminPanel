import { atom, useSetAtom } from 'jotai';
import { atomEffect } from 'jotai-effect'
import { globalStatusAtom } from './status';
import { playerCountAtom } from './playerlist';


/**
 * This atom is used to change the key of the main page error boundry, which also resets the router 
 * as a side effect. This is used to reset the page that errored as well as resetting the current 
 * page when the user clicks on the active menu link.
 */
export const contentRefreshKeyAtom = atom(0);

//Hook to refresh content
export const useContentRefresh = () => {
    const setContentRefreshKey = useSetAtom(contentRefreshKeyAtom);
    return () => setContentRefreshKey(Math.random());
};

/**
 * This atom describes if the main page is in error state or not.
 * When the page is in error, clicking on any menu link will reset the error boundry and router,
 * therefore also resetting the page that errored.
 */
export const pageErrorStatusAtom = atom(false);



/**
 * Page title management
 */
const DEFAULT_TITLE = window.txConsts.panelName;
const faviconEl = document.getElementById('favicon') as HTMLLinkElement;
export const pageTitleAtom = atom(DEFAULT_TITLE);

export const useSetPageTitle = () => {
    const setPageTitle = useSetAtom(pageTitleAtom);
    return (title?: string) => {
        if (title) {
            setPageTitle(title);
        } else {
            // probably logout, pageTitleWatcher is not watching!
            setPageTitle(DEFAULT_TITLE);
            document.title = DEFAULT_TITLE;
            faviconEl.href = window.txConsts.faviconUrl;
        }
    };
}

export const pageTitleWatcher: ReturnType<typeof atomEffect> = atomEffect((get, set) => {
    if (!window.txConsts.isWebInterface) return;
    const pageTitle = get(pageTitleAtom);
    const globalStatus = get(globalStatusAtom);
    const playerCount = get(playerCountAtom);

    if (!globalStatus) {
        faviconEl.href = window.txConsts.faviconUrl;
        document.title = DEFAULT_TITLE;
    } else {
        faviconEl.href = window.txConsts.faviconUrl;
        document.title = `(${playerCount}) ${DEFAULT_TITLE} · ${pageTitle}`;
    }
});
