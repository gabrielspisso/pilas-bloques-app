import { render, screen } from '@testing-library/react'
import { createTheme } from '@mui/material'
import { getCreatorDesignTokens, MIN_TOUCH_TARGET_PX } from '../../../../theme/creatorTheme'
import { ThemeContext, setBlocklyTheme } from '../../../../theme/ThemeContext'
import { GridSizePicker } from '../../../../components/creator/Editor/SceneEdition/GridOptions/GridSizePicker'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { LocalStorage } from '../../../../localStorage'
import { defaultChallenge } from '../../../../components/serializedChallenge'

// jsdom has no layout nor (pointer: coarse): these tests check the declared sizes.
describe('Touch targets of at least 44px in the creator', () => {
    test('buttons, icon buttons, card actions and switch labels get a 44px minimum on coarse pointers', () => {
        const components: any = createTheme(getCreatorDesignTokens(false, false)).components
        for (const name of ['MuiButton', 'MuiIconButton', 'MuiCardActionArea', 'MuiFormControlLabel'])
            expect(components[name].styleOverrides.root['@media (pointer: coarse)'].minHeight).toBe(MIN_TOUCH_TARGET_PX)
        expect(components.MuiIconButton.styleOverrides.root['@media (pointer: coarse)'].minWidth).toBe(MIN_TOUCH_TARGET_PX)
    })

    test('the grid size button (replaces the +/- buttons) is at least 44px tall', () => {
        LocalStorage.saveCreatorChallenge(defaultChallenge('Lita'))
        render(<ThemeContext.Provider value={{
            darkModeEnabled: false, setDarkModeEnabled: () => { }, simpleReadModeEnabled: false, setSimpleReadModeEnabled: () => { },
            theme: createTheme(), isSmallScreen: true, blocklyTheme: setBlocklyTheme(false)
        }}>
            <CreatorContextProvider><GridSizePicker /></CreatorContextProvider>
        </ThemeContext.Provider>)
        expect(getComputedStyle(screen.getByTestId('grid-size-button')).minHeight).toBe('44px')
        localStorage.clear()
    })
})
