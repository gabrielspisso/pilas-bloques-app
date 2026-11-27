import { render, screen } from '@testing-library/react'
import { useTheme } from '@mui/material'
import { CreatorThemeProvider, toyColors } from '../../../../theme/creatorTheme'
import { ThemeContextProvider, useThemeContext } from '../../../../theme/ThemeContext'
import { LocalStorage } from '../../../../localStorage'

const Probe = ({ id }: { id: string }) => {
    const { theme } = useThemeContext()
    const muiTheme = useTheme()
    return <span data-testid={id}>{`${theme.palette.primary.main}|${muiTheme.palette.primary.main}|${theme.shape.borderRadius}`}</span>
}

describe('Creator "Jugueteria" theme', () => {
    afterEach(() => localStorage.clear())

    test('applies only inside the creator provider (light mode)', () => {
        LocalStorage.saveDarkMode(false)
        render(<ThemeContextProvider>
            <Probe id="outside" />
            <CreatorThemeProvider><Probe id="inside" /></CreatorThemeProvider>
        </ThemeContextProvider>)

        expect(screen.getByTestId('inside').textContent).toBe(`${toyColors.violet}|${toyColors.violet}|16`)
        expect(screen.getByTestId('outside').textContent).not.toContain(toyColors.violet)
    })

    test('respects dark mode', () => {
        LocalStorage.saveDarkMode(true)
        render(<ThemeContextProvider>
            <CreatorThemeProvider><Probe id="inside" /></CreatorThemeProvider>
        </ThemeContextProvider>)

        expect(screen.getByTestId('inside').textContent).toBe(`${toyColors.violetLight}|${toyColors.violetLight}|16`)
    })
})
