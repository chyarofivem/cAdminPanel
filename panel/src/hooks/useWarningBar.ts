import { atom, useAtom, useSetAtom } from 'jotai';
import type { UpdateAvailableEventType } from '@shared/socketioTypes';


/**
 * Atoms
 */
const offlineWarningAtom = atom(false);
const updateAvailableAtom = atom<UpdateAvailableEventType | null>(null);


/**
 * Hooks
 */
export default function useWarningBar() {
    const [offlineWarning, setOfflineWarning] = useAtom(offlineWarningAtom);
    const [updateAvailable, setUpdateAvailable] = useAtom(updateAvailableAtom);

    return {
        offlineWarning, setOfflineWarning,
        updateAvailable, setUpdateAvailable,
    };
}

//Marks the socket as offline or online
export const useSetOfflineWarning = () => {
    return useSetAtom(offlineWarningAtom);
}

//Stores the update data received from the server
export const useSetUpdateAvailable = () => {
    return useSetAtom(updateAvailableAtom);
}
