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
  '&.tx-communication-notification': {
    width: 'min(440px, calc(100vw - 32px))',
    minWidth: 0,
    padding: 0,
    overflow: 'hidden',
    color: '#f8fafc',
    background: 'rgba(10, 15, 21, 0.96)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    boxShadow: '0 20px 55px rgba(0, 0, 0, 0.46), 0 4px 14px rgba(0, 0, 0, 0.26)',
    backdropFilter: 'blur(18px)',
  },
  '&.tx-communication-notification--announcement': {
    '--tx-comms-accent': '#fbbf24',
    '--tx-comms-accent-soft': 'rgba(251, 191, 36, 0.14)',
  },
  '&.tx-communication-notification--direct-message': {
    '--tx-comms-accent': theme.palette.primary.main,
    '--tx-comms-accent-soft': 'rgba(0, 197, 140, 0.14)',
  },
  '& .tx-communication-card': {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '48px minmax(0, 1fr)',
    gap: 14,
    width: '100%',
    padding: '18px 20px 18px 18px',
  },
  '& .tx-communication-card__accent': {
    position: 'absolute',
    inset: '0 auto 0 0',
    width: 4,
    background: 'var(--tx-comms-accent)',
    boxShadow: '0 0 24px var(--tx-comms-accent)',
  },
  '& .tx-communication-card__icon': {
    display: 'grid',
    placeItems: 'center',
    alignSelf: 'start',
    width: 46,
    height: 46,
    border: '1px solid color-mix(in srgb, var(--tx-comms-accent) 42%, transparent)',
    borderRadius: 13,
    color: 'var(--tx-comms-accent)',
    background: 'var(--tx-comms-accent-soft)',
  },
  '& .tx-communication-card__icon svg': {
    fontSize: 24,
  },
  '& .tx-communication-card__content': {
    minWidth: 0,
  },
  '& .tx-communication-card__title': {
    margin: 0,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 750,
    lineHeight: 1.35,
  },
  '& .tx-communication-card__message': {
    margin: '8px 0 0',
    color: 'rgba(241, 245, 249, 0.84)',
    fontSize: 14,
    fontWeight: 450,
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  },
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
