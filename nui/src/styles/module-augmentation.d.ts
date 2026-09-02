import "@mui/material/styles";

declare module '@mui/material/styles' {
    interface Theme {
        name: string;
    }

    // allow configuration using `createTheme`
    interface ThemeOptions {
        name?: string;
    }
}

export {};
