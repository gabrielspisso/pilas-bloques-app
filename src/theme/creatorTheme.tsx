import { createTheme, ThemeOptions, ThemeProvider } from "@mui/material";
import { deepmerge } from '@mui/utils';
import { FC, PropsWithChildren, useMemo } from "react";
import { getDesignTokens } from "./theme";
import { ThemeContext, useThemeContext } from "./ThemeContext";

/**
 * "Jugueteria" palette, used only inside the challenge creator.
 * Accent colors are the ones used by the home level cards (BookCards.tsx)
 * and the home background (App.css --home-background).
 */
export const toyColors = {
    plum: '#311C3B',
    plumDeep: '#1C0F22',
    plumCard: '#3A2444',
    plumPaper: '#2A1832',
    ink: '#2E1A36',
    yellow: '#FCE965',
    green: '#97EA6C',
    cyan: '#A0EAE8',
    violet: '#6A3FD1',
    violetLight: '#B9A2F5',
    white: '#FFFFFF'
}

/** Page background behind the creator cards. */
export const creatorPageBackground = (darkModeEnabled: boolean) => darkModeEnabled ? toyColors.plumDeep : toyColors.plum

const toyCommon: ThemeOptions = {
    shape: {
        borderRadius: 16
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: { borderRadius: 16 }
            }
        }
    }
}

const toyLight: ThemeOptions = {
    typography: {
        allVariants: { color: toyColors.ink }
    },
    palette: {
        primary: { main: toyColors.violet, contrastText: toyColors.white },
        secondary: { main: toyColors.yellow, contrastText: toyColors.ink },
        success: { main: toyColors.green, contrastText: toyColors.ink },
        info: { main: toyColors.cyan, contrastText: toyColors.ink },
        text: { primary: toyColors.ink },
        background: { default: toyColors.white, paper: toyColors.white }
    },
    components: {
        MuiButtonGroup: {
            styleOverrides: {
                grouped: { backgroundColor: toyColors.yellow }
            }
        }
    }
}

const toyDark: ThemeOptions = {
    palette: {
        // A lighter violet keeps outlined buttons and icons readable on dark plum.
        primary: { main: toyColors.violetLight, contrastText: toyColors.ink },
        secondary: { main: toyColors.yellow, contrastText: toyColors.ink },
        success: { main: toyColors.green, contrastText: toyColors.ink },
        info: { main: toyColors.cyan, contrastText: toyColors.ink },
        background: { default: toyColors.plumCard, paper: toyColors.plumPaper }
    },
    components: {
        MuiButtonGroup: {
            styleOverrides: {
                grouped: { backgroundColor: '#4A3155' }
            }
        }
    }
}

export const getCreatorDesignTokens = (darkModeEnabled: boolean, simpleReadModeEnabled: boolean): ThemeOptions =>
    deepmerge(getDesignTokens(darkModeEnabled, simpleReadModeEnabled), deepmerge(darkModeEnabled ? toyDark : toyLight, toyCommon))

/**
 * Nested theme for the creator: replaces both the MUI theme and the theme exposed by
 * ThemeContext (most creator components read it through useThemeContext), so it does
 * not leak to the rest of the app. Dark/light and simple read modes are preserved.
 */
export const CreatorThemeProvider: FC<PropsWithChildren> = ({ children }) => {
    const themeContext = useThemeContext()
    const { darkModeEnabled, simpleReadModeEnabled } = themeContext

    const theme = useMemo(
        () => createTheme(getCreatorDesignTokens(darkModeEnabled, simpleReadModeEnabled)),
        [darkModeEnabled, simpleReadModeEnabled]
    )

    return <ThemeContext.Provider value={{ ...themeContext, theme }}>
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    </ThemeContext.Provider>
}
