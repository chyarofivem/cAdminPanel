import { useCallback } from "react";
import { TxConfigState } from "@shared/enums";
import { GlobalStatusType } from "@shared/socketioTypes";
import { atom, useAtomValue, useSetAtom } from "jotai";


/**
 * Atoms
 */
export const globalStatusAtom = atom<GlobalStatusType | null>(null);
export const serverNameAtom = atom((get) => get(globalStatusAtom)?.server.name ?? 'unconfigured');
export const txConfigStateAtom = atom((get) => get(globalStatusAtom)?.configState ?? TxConfigState.Unkown);
export const fxRunnerStateAtom = atom((get) => get(globalStatusAtom)?.runner ?? {
    isIdle: true,
    isChildAlive: false,
});


/**
 * Hooks
 */
export const useSetGlobalStatus = () => {
    return useSetAtom(globalStatusAtom);
};

export const useGlobalStatus = () => {
    return useAtomValue(globalStatusAtom);
}

/**
 * The global status is only pushed over the websocket every few seconds, so a route that
 * just answered with the live config state (the setup and deployer wizards do) knows better
 * than the cached value. Correcting it locally keeps pages from acting on a config state
 * that is already gone, which would bounce the admin between contradictory redirects.
 */
export const useSetTxConfigState = () => {
    const setGlobalStatus = useSetAtom(globalStatusAtom);
    return useCallback((configState: TxConfigState) => {
        setGlobalStatus((previous) => (
            !previous || previous.configState === configState
                ? previous
                : { ...previous, configState }
        ));
    }, [setGlobalStatus]);
};
