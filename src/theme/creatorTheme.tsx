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

/** Touch screens (coarse pointer): every interactive control at least this big. */
export const MIN_TOUCH_TARGET_PX = 44
const COARSE_POINTER = '@media (pointer: coarse)'

const toyCommon: ThemeOptions = {
    shape: {
        borderRadius: 16
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: { borderRadius: 16, [COARSE_POINTER]: { minHeight: MIN_TOUCH_TARGET_PX, minWidth: MIN_TOUCH_TARGET_PX } }
            }
        },
        MuiIconButton: {
            styleOverrides: {
                root: { [COARSE_POINTER]: { minHeight: MIN_TOUCH_TARGET_PX, minWidth: MIN_TOUCH_TARGET_PX } }
            }
        },
        MuiCardActionArea: {
            styleOverrides: {
                root: { [COARSE_POINTER]: { minHeight: MIN_TOUCH_TARGET_PX } }
            }
        },
        // The whole label is clickable, so it is the switch's touch target.
        MuiFormControlLabel: {
            styleOverrides: {
                root: { [COARSE_POINTER]: { minHeight: MIN_TOUCH_TARGET_PX } }
            }
        },
        MuiTab: {
            styleOverrides: {
                root: { [COARSE_POINTER]: { minHeight: MIN_TOUCH_TARGET_PX } }
            }
        }
    }
}

const focusRing = (color: string) => ({
    MuiButtonBase: {
        styleOverrides: {
            root: { '&.Mui-focusVisible': { outline: `3px solid ${color}`, outlineOffset: '2px' } }
        }
    }
})

const toyLight: ThemeOptions = {
    typography: {
        allVariants: { color: toyColors.ink }
    },
    palette: {
        primary: { main: toyColors.violet, contrastText: toyColors.white },
        secondary: { main: toyColors.yellow, contrastText: toyColors.ink },
        success: { main: toyColors.green, dark: '#2F7A1F', contrastText: toyColors.ink }, // dark: icons on white (AA 3:1)
        info: { main: toyColors.cyan, contrastText: toyColors.ink },
        text: { primary: toyColors.ink },
        background: { default: toyColors.white, paper: toyColors.white }
    },
    components: {
        ...focusRing(toyColors.violet),
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
        success: { main: toyColors.green, dark: toyColors.green, contrastText: toyColors.ink }, // dark: icons on plum
        info: { main: toyColors.cyan, contrastText: toyColors.ink },
        background: { default: toyColors.plumCard, paper: toyColors.plumPaper }
    },
    components: {
        ...focusRing(toyColors.yellow),
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
