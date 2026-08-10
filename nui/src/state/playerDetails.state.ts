import { atom, useRecoilValue, useSetRecoilState } from "recoil";
import { PlayerData } from "../hooks/usePlayerListListener";

const associatedPlayerAtom = atom<PlayerData | null>({
  key: "associatedPlayerDetails",
  default: null,
});

export const useAssociatedPlayerValue = () =>
  useRecoilValue(associatedPlayerAtom);

export const useSetAssociatedPlayer = () =>
  useSetRecoilState(associatedPlayerAtom);
