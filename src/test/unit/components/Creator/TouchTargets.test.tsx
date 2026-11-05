import { render, screen } from '@testing-library/react'
import { createTheme } from '@mui/material'
import { getCreatorDesignTokens, MIN_TOUCH_TARGET_PX } from '../../../../theme/creatorTheme'
import { ThemeContext, setBlocklyTheme } from '../../../../theme/ThemeContext'
import { IncDecButtons } from '../../../../components/creator/Editor/SceneEdition/GridOptions/IncDecButtons'

// jsdom has no layout nor (pointer: coarse): these tests check the declared sizes.
describe('Touch targets of at least 44px in the creator', () => {
    test('buttons, icon buttons, card actions and switch labels get a 44px minimum on coarse pointers', () => {
        const components: any = createTheme(getCreatorDesignTokens(false, false)).components
        for (const name of ['MuiButton', 'MuiIconButton', 'MuiCardActionArea', 'MuiFormControlLabel'])
            expect(components[name].styleOverrides.root['@media (pointer: coarse)'].minHeight).toBe(MIN_TOUCH_TARGET_PX)
        expect(components.MuiIconButton.styleOverrides.root['@media (pointer: coarse)'].minWidth).toBe(MIN_TOUCH_TARGET_PX)
    })

    test('the +/- grid size buttons are not narrower than 44px on small screens', () => {
        render(<ThemeContext.Provider value={{
            darkModeEnabled: false, setDarkModeEnabled: () => { }, simpleReadModeEnabled: false, setSimpleReadModeEnabled: () => { },
            theme: createTheme(), isSmallScreen: true, blocklyTheme: setBlocklyTheme(false)
        }}>
            <IncDecButtons add={() => { }} remove={() => { }} value={3} min={1} max={10} testId="row" />
        </ThemeContext.Provider>)
        expect(screen.getByTestId('inc-btn-row').style.minWidth).toBe('44px')
        expect(screen.getByTestId('dec-btn-row').style.minWidth).toBe('44px')
    })
})
