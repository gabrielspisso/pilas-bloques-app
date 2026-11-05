import { fireEvent, render, screen } from '@testing-library/react'
import { createTheme } from '@mui/material'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { SceneEdition } from '../../../../components/creator/Editor/SceneEdition/SceneEdition'
import { getCreatorDesignTokens, toyColors } from '../../../../theme/creatorTheme'

// WCAG 2.x relative luminance / contrast ratio
const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (l1 + 0.05) / (l2 + 0.05)
}

describe('Creator accessibility', () => {
    describe('contrast (AA: 4.5 text, 3 for UI parts)', () => {
        const light = createTheme(getCreatorDesignTokens(false, false)).palette
        const dark = createTheme(getCreatorDesignTokens(true, false)).palette

        test.each([
            ['light text on cards', light.text.primary, light.background.default, 4.5],
            ['light text on dialogs', light.text.primary, light.background.paper, 4.5],
            ['light primary buttons', light.primary.contrastText, light.primary.main, 4.5],
            ['light outlined/primary text on cards', light.primary.main, light.background.default, 4.5],
            ['light text on +/- buttons', light.text.primary, toyColors.yellow, 4.5],
            ['light checklist done icon', light.success.dark, light.background.default, 3],
            ['dark text on cards', dark.text.primary, dark.background.default, 4.5],
            ['dark text on dialogs', dark.text.primary, dark.background.paper, 4.5],
            ['dark primary on cards', dark.primary.main, dark.background.default, 4.5],
            ['dark primary buttons', dark.primary.contrastText, dark.primary.main, 4.5],
            ['dark focus ring on cards', toyColors.yellow, dark.background.default, 3],
            ['dark checklist done icon', dark.success.dark, dark.background.default, 3],
        ])('%s', (_, foreground, background, minimum) => {
            expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum)
        })
    })

    describe('board with keyboard', () => {
        beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge('Lita')))
        afterEach(() => localStorage.clear())

        const renderEditor = async (tool: string) => {
            render(<I18nextProvider i18n={i18n}>
                <CreatorContextProvider defaultSelectedTool={tool}><SceneEdition /></CreatorContextProvider>
            </I18nextProvider>)
            await screen.findByRole('grid')
        }
        const savedMap = () => LocalStorage.getCreatorChallenge()!.scene.maps[0]
        const focusedCell = () => document.activeElement as HTMLElement

        test('grid, rows and cells have roles and labels; a single Tab stop', async () => {
            await renderEditor('T')
            expect(screen.getByRole('grid')).toHaveAccessibleName(/3 filas por 3 columnas/)
            expect(screen.getAllByRole('row')).toHaveLength(3)
            const cells = screen.getAllByRole('gridcell')
            expect(cells[0]).toHaveAccessibleName('Fila 1, columna 1: Lita')
            expect(cells[4]).toHaveAccessibleName('Fila 2, columna 2: vacía')
            expect(cells.filter(c => c.tabIndex === 0)).toHaveLength(1)
        })

        test('arrows move, Enter places the active tool, Delete erases, focus is kept', async () => {
            await renderEditor('T')
            screen.getAllByRole('gridcell')[0].focus()
            fireEvent.keyDown(focusedCell(), { key: 'ArrowRight' })
            fireEvent.keyDown(focusedCell(), { key: 'ArrowDown' })
            expect(focusedCell()).toHaveAccessibleName('Fila 2, columna 2: vacía')

            fireEvent.keyDown(focusedCell(), { key: 'Enter' })
            expect(savedMap()[1][1]).toBe('T')
            expect(focusedCell()).toHaveAccessibleName('Fila 2, columna 2: tomate')

            fireEvent.keyDown(focusedCell(), { key: 'Delete' })
            expect(savedMap()[1][1]).toBe('-')
            expect(focusedCell()).toHaveAccessibleName('Fila 2, columna 2: vacía')
        })

        test('arrows stop at the edges', async () => {
            await renderEditor('T')
            screen.getAllByRole('gridcell')[0].focus()
            fireEvent.keyDown(focusedCell(), { key: 'ArrowUp' })
            fireEvent.keyDown(focusedCell(), { key: 'ArrowLeft' })
            expect(focusedCell()).toHaveAccessibleName('Fila 1, columna 1: Lita')
        })

        test('palette tools have names and say which one is selected', async () => {
            await renderEditor('T')
            expect(screen.getByRole('button', { name: 'Añadir tomate' })).toHaveAttribute('aria-pressed', 'true')
            expect(screen.getByRole('button', { name: 'Añadir lechuga' })).toHaveAttribute('aria-pressed', 'false')
            expect(screen.getByRole('button', { name: /Borrar/ })).toBeInTheDocument()
        })
    })
})
