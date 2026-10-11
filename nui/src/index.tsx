import React from "react";
import { createRoot } from "react-dom/client";
import MenuWrapper from "./MenuWrapper";
import "./index.css";
import { RecoilRoot } from "recoil";
import { KeyboardNavProvider } from "./provider/KeyboardNavProvider";
import { SnackbarProvider } from "notistack";
import { registerDebugFunctions } from "./utils/registerDebugFunctions";
import { useNuiEvent } from "./hooks/useNuiEvent";
import { useIsRedm } from "./state/isRedm.state";
import { useApplyAccent } from "./styles/applyAccent";
import { Toast, ToastTransition } from "./components/Hud/Toast";

registerDebugFunctions();

/**
 * FiveM and RedM share one design system (styles/menu.css). The game flag only
 * changes game-specific behaviour, never the palette.
 */
const App = () => {
  const [, setIsRedm] = useIsRedm();

  useNuiEvent<string>("setGameName", (gameName: string) => {
    setIsRedm(gameName === "redm");
  });

  useApplyAccent();

  return (
    <KeyboardNavProvider>
      <SnackbarProvider
        maxSnack={5}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        disableWindowBlurListener={true}
        TransitionComponent={ToastTransition}
        Components={{
          default: Toast,
          info: Toast,
          success: Toast,
          warning: Toast,
          error: Toast,
        }}
      >
        <React.Suspense fallback={<></>}>
          <MenuWrapper />
        </React.Suspense>
      </SnackbarProvider>
    </KeyboardNavProvider>
  );
};


const rootContainer = document.getElementById("root");
if (!rootContainer) {
  throw new Error("Unable to mount the in-game menu: #root was not found");
}
const root = createRoot(rootContainer);
root.render(
  <RecoilRoot>
    <App />
  </RecoilRoot>
);
