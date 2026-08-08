import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import MenuWrapper from "./MenuWrapper";
import "./index.css";
import { ThemeProvider, StyledEngineProvider, createTheme } from "@mui/material";
import { RecoilRoot } from "recoil";
import { KeyboardNavProvider } from "./provider/KeyboardNavProvider";
import { MaterialDesignContent, SnackbarProvider } from "notistack";
import { registerDebugFunctions } from "./utils/registerDebugFunctions";
import { useNuiEvent } from "./hooks/useNuiEvent";
import styled from "@emotion/styled";
import rawMenuTheme from "./styles/theme";
import rawMenuRedmTheme from "./styles/theme-redm";
import { useIsRedm } from "./state/isRedm.state";
import { useServerCtxValue } from "./state/server.state";

registerDebugFunctions();

//Instantiating the two themes
declare module '@mui/material/styles' {
  interface Theme {
      name: string;
      logo: string;
  }

  // allow configuration using `createTheme`
  interface ThemeOptions {
      name?: string;
      logo?: string;
  }
}
const menuRedmTheme = createTheme(rawMenuRedmTheme);

//Overwriting the notistack colors
//Actually using the colors from the RedM theme, but could start using `theme` if needed
const StyledMaterialDesignContent = styled(MaterialDesignContent)(({ theme }) => ({
  '&.notistack-MuiContent-default': {
    color: menuRedmTheme.palette.text.primary,
    backgroundColor: menuRedmTheme.palette.background.default,
  },
  '&.notistack-MuiContent-info': {
    backgroundColor: menuRedmTheme.palette.info.main,
    color: menuRedmTheme.palette.info.contrastText,
  },
  '&.notistack-MuiContent-success': {
    backgroundColor: menuRedmTheme.palette.success.main,
    color: menuRedmTheme.palette.success.contrastText,
  },
  '&.notistack-MuiContent-warning': {
    backgroundColor: menuRedmTheme.palette.warning.main,
    color: menuRedmTheme.palette.warning.contrastText,
  },
  '&.notistack-MuiContent-error': {
    backgroundColor: menuRedmTheme.palette.error.main,
    color: menuRedmTheme.palette.error.contrastText,
  },
}));


const App = () => {
  const [isRedm, setIsRedm] = useIsRedm();
  const serverCtx = useServerCtxValue();

  useNuiEvent<string>("setGameName", (gameName: string) => {
    setIsRedm(gameName === 'redm')
  });

  const selectedTheme = useMemo(() => {
    const rawTheme = isRedm ? rawMenuRedmTheme : rawMenuTheme;
    return createTheme({
      ...rawTheme,
      palette: {
        ...rawTheme.palette,
        primary: {
          ...rawTheme.palette.primary,
          main: serverCtx.accentColor || rawTheme.palette.primary.main,
        },
      },
    } as any);
  }, [isRedm, serverCtx.accentColor]);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={selectedTheme}>
        <KeyboardNavProvider>
          <SnackbarProvider
            maxSnack={5}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            disableWindowBlurListener={true}
            Components={{
              default: StyledMaterialDesignContent,
              info: StyledMaterialDesignContent,
              success: StyledMaterialDesignContent,
              warning: StyledMaterialDesignContent,
              error: StyledMaterialDesignContent,
            }}
          >
            <React.Suspense fallback={<></>}>
              <MenuWrapper />
            </React.Suspense>
          </SnackbarProvider>
        </KeyboardNavProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  )
}


const rootContainer = document.getElementById("root");
const root = createRoot(rootContainer);
root.render(
  <RecoilRoot>
    <App />
  </RecoilRoot>
);
