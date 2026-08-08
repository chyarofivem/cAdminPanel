import { useTheme } from "@/hooks/theme";
import { useEffect } from "react";

type ThemeProviderProps = {
    children: React.ReactNode;
};
export default function ThemeProvider({ children }: ThemeProviderProps) {
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (theme !== 'dark') setTheme('dark');
    }, []);

    return <>{children}</>;
}
