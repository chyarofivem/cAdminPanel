import { atom, useAtom, useSetAtom } from 'jotai';


/**
 * Atoms
 */
const offlineWarningAtom = atom(false);


/**
 * Hooks
 */
export default function useWarningBar() {
    const [offlineWarning, setOfflineWarning] = useAtom(offlineWarningAtom);

    return {
        offlineWarning, setOfflineWarning,
    };
}

//Marks the socket as offline or online
export const useSetOfflineWarning = () => {
    return useSetAtom(offlineWarningAtom);
}
