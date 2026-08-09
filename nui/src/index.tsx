import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import MenuWrapper from "./MenuWrapper";
import "./index.css";
import { alpha, ThemeProvider, StyledEngineProvider, createTheme, type Theme } from "@mui/material";
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
const StyledMaterialDesignContent = styled(MaterialDesignContent)(({ theme }) => {
  const muiTheme = theme as Theme;

  return ({
  '&.tx-communication-notification--announcement': {
    '--tx-comms-accent': '#fbbf24',
    '--tx-comms-accent-soft': 'rgba(251, 191, 36, 0.14)',
  },
  '&.tx-communication-notification--direct-message': {
    '--tx-comms-accent': muiTheme.palette.primary.main,
    '--tx-comms-accent-soft': alpha(muiTheme.palette.primary.main, 0.14),
  },
  '& .tx-communication-card': {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '36px minmax(0, 1fr)',
    gap: 11,
    width: '100%',
    padding: '13px 15px 13px 14px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    color: '#f8fafc',
    background: 'rgba(10, 15, 21, 0.96)',
    border: 0,
    borderRadius: 12,
    boxShadow: '0 14px 38px rgba(0, 0, 0, 0.38), 0 3px 10px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(14px)',
  },
  '& .tx-communication-card__accent': {
    position: 'absolute',
    inset: '0 auto 0 0',
    width: 3,
    background: 'var(--tx-comms-accent)',
    boxShadow: '0 0 24px var(--tx-comms-accent)',
  },
  '& .tx-communication-card__icon': {
    display: 'grid',
    placeItems: 'center',
    alignSelf: 'start',
    width: 36,
    height: 36,
    border: 0,
    borderRadius: 10,
    color: 'var(--tx-comms-accent)',
    background: 'var(--tx-comms-accent-soft)',
  },
  '& .tx-communication-card__icon svg': {
    fontSize: 20,
  },
  '& .tx-communication-card__content': {
    minWidth: 0,
  },
  '& .tx-communication-card__title': {
    margin: 0,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 750,
    lineHeight: 1.35,
  },
  '& .tx-communication-card__message': {
    margin: '4px 0 0',
    color: 'rgba(241, 245, 249, 0.88)',
    fontSize: 13.5,
    fontWeight: 500,
    lineHeight: 1.45,
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

  //The communication notifications draw their own card, so the notistack
  //content root must stay fully transparent - otherwise the variant colors
  //above paint a solid frame around the card. Declared last (and with the
  //variant class) so it always wins over the variant rules.
  '&.tx-communication-notification, &.tx-communication-notification.notistack-MuiContent-info, &.tx-communication-notification.notistack-MuiContent-warning': {
    display: 'block',
    width: 'min(400px, calc(100vw - 32px))',
    maxWidth: '100%',
    minWidth: 0,
    padding: 0,
    overflow: 'hidden',
    border: 'none',
    borderRadius: 12,
    background: 'transparent',
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    boxShadow: 'none',
    color: '#f8fafc',
  },
  '&.tx-communication-notification > #notistack-snackbar': {
    display: 'block',
    width: '100%',
    padding: 0,
  },
  });
});


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
if (!rootContainer) {
  throw new Error("Unable to mount txAdmin NUI: #root was not found");
}
const root = createRoot(rootContainer);
root.render(
  <RecoilRoot>
    <App />
  </RecoilRoot>
);
