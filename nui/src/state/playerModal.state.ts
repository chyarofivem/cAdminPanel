import { atom, useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";

const modalVisibilityAtom = atom({
  key: "playerModalVisibility",
  default: false,
});

export const usePlayerModalVisbilityValue = () =>
  useRecoilValue(modalVisibilityAtom);
export const usePlayerModalVisibility = () =>
  useRecoilState(modalVisibilityAtom);
export const useSetPlayerModalVisibility = () =>
  useSetRecoilState(modalVisibilityAtom);
