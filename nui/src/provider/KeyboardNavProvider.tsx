import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { fetchNui } from "../utils/fetchNui";
import { useIsMenuVisibleValue } from "../state/visibility.state";
import { txAdminMenuPage, usePageValue } from "../state/page.state";

const KeyboardNavContext = createContext<KeyboardNavProviderValue | null>(null);

interface KeyboardNavProviderProps {
  children: ReactNode;
}

export const KeyboardNavProvider: React.FC<KeyboardNavProviderProps> = ({
  children,
}) => {
  const [disabledKeyNav, setDisabledKeyNav] = useState(false);
  const isMenuVisible = useIsMenuVisibleValue();
  const curPage = usePageValue();

  const handleSetDisabledInputs = useCallback((bool: boolean) => {
    setDisabledKeyNav(bool);
  }, []);

  useEffect(() => {
    if (!isMenuVisible) return;

    if (
      curPage === txAdminMenuPage.IFrame
      || curPage === txAdminMenuPage.Players
      || curPage === txAdminMenuPage.PlayerModalOnly
    ) {
      return setDisabledKeyNav(true);
    }

    if (curPage === txAdminMenuPage.Main) {
      return setDisabledKeyNav(false);
    }
  }, [curPage, isMenuVisible]);

  useEffect(() => {
    if (!isMenuVisible) return;
    fetchNui("focusInputs", disabledKeyNav, { mockResp: {} });
  }, [disabledKeyNav, isMenuVisible]);

  return (
    <KeyboardNavContext.Provider
      value={{
        disabledKeyNav: disabledKeyNav,
        setDisabledKeyNav: handleSetDisabledInputs,
      }}
    >
      {children}
    </KeyboardNavContext.Provider>
  );
};

interface KeyboardNavProviderValue {
  disabledKeyNav: boolean;
  setDisabledKeyNav: (bool: boolean) => void;
}

export const useKeyboardNavContext = () => {
  const context = useContext(KeyboardNavContext);
  if (!context) throw new Error("useKeyboardNavContext must be used within KeyboardNavProvider");
  return context;
};
