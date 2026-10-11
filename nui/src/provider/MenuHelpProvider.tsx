import React, { createContext, ReactNode, useCallback, useContext, useState } from "react";

interface MenuHelpContextValue {
  helpText: string;
  setHelpText: (text: string) => void;
}

const MenuHelpCtx = createContext<MenuHelpContextValue | null>(null);

/**
 * Holds the description of the selected main-page action. The menu shows it in
 * its help line instead of a floating tooltip.
 */
export const MenuHelpProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [helpText, setHelpTextState] = useState("");
  const setHelpText = useCallback((text: string) => setHelpTextState(text), []);
  return (
    <MenuHelpCtx.Provider value={{ helpText, setHelpText }}>
      {children}
    </MenuHelpCtx.Provider>
  );
};

export const useMenuHelp = () => {
  const context = useContext(MenuHelpCtx);
  if (!context) throw new Error("useMenuHelp must be used within MenuHelpProvider");
  return context;
};
