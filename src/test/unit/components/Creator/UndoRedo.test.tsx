import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { SceneGrid } from '../../../../components/creator/Editor/SceneEdition/Grid/SceneGrid'
import { UndoRedoButtons } from '../../../../components/creator/Editor/EditorSubHeader/UndoRedoButtons'
import { SceneEdition } from '../../../../components/creator/Editor/SceneEdition/SceneEdition'
import { OBSTACLE } from '../../../../components/creator/Editor/SceneEdition/mapUtils'

describe('Undo and redo', () => {
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge('Lita')))
    afterEach(() => localStorage.clear())

    const savedMap = () => LocalStorage.getCreatorChallenge()!.scene.maps[0]
    const cell = (n: number) => screen.getAllByTestId('challenge-cell')[n]
    const undoKey = () => fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    const redoKey = () => fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })

    const renderEditor = async () => {
        render(<I18nextProvider i18n={i18n}>
        <CreatorContextProvider defaultSelectedTool={OBSTACLE}>
            <SceneGrid />
            <UndoRedoButtons />
            <input data-testid="text-field" />
        </CreatorContextProvider>
    </I18nextProvider>)
        await screen.findByTestId('undo-button') // translations load asynchronously
    }

    test('buttons are disabled when there is nothing to undo or redo', async () => {
        await renderEditor()
        expect(screen.getByTestId('undo-button')).toBeDisabled()
        expect(screen.getByTestId('redo-button')).toBeDisabled()
    })

    test('three pieces, three Ctrl+Z go back to the start and redo repeats them', async () => {
        await renderEditor()
        const initial = JSON.stringify(savedMap())

        fireEvent.click(cell(1))
        fireEvent.click(cell(2))
        fireEvent.click(cell(3))
        const edited = JSON.stringify(savedMap())
        expect(savedMap()[0]).toEqual(['A', 'O', 'O'])
        expect(savedMap()[1][0]).toBe('O')
        expect(screen.getByTestId('undo-button')).not.toBeDisabled()

        undoKey(); undoKey(); undoKey()
        expect(JSON.stringify(savedMap())).toBe(initial)
        expect(screen.getByTestId('undo-button')).toBeDisabled()

        redoKey(); redoKey(); redoKey()
        expect(JSON.stringify(savedMap())).toBe(edited)
        expect(screen.getByTestId('redo-button')).toBeDisabled()
    })

    test('buttons undo and redo too, and a new edit clears the redo stack', async () => {
        await renderEditor()
        fireEvent.click(cell(1))
        fireEvent.click(screen.getByTestId('undo-button'))
        expect(savedMap()[0][1]).toBe('-')
        expect(screen.getByTestId('redo-button')).not.toBeDisabled()

        fireEvent.click(cell(2))
        expect(screen.getByTestId('redo-button')).toBeDisabled()
    })

    test('a click that changes nothing is not a history step', async () => {
        await renderEditor()
        fireEvent.click(cell(0)) // obstacle over the actor at the initial cell: not allowed
        expect(screen.getByTestId('undo-button')).toBeDisabled()
    })

    test('shortcut is ignored while typing in a text field', async () => {
        await renderEditor()
        fireEvent.click(cell(1))
        fireEvent.keyDown(screen.getByTestId('text-field'), { key: 'z', ctrlKey: true })
        expect(savedMap()[0][1]).toBe(OBSTACLE)
    })

    test('the saved draft is still a valid challenge after undoing', async () => {
        await renderEditor()
        fireEvent.click(cell(4))
        undoKey()
        const saved = LocalStorage.getCreatorChallenge()!
        expect(saved.scene.type).toBe('Lita')
        expect(saved.scene.maps[0]).toEqual(defaultChallenge('Lita').scene.maps[0])
    })

    test('grid size changes can be undone too', async () => {
        render(<I18nextProvider i18n={i18n}>
            <CreatorContextProvider>
                <SceneEdition />
                <UndoRedoButtons />
            </CreatorContextProvider>
        </I18nextProvider>)
        fireEvent.click(await screen.findByTestId('grid-size-button'))
        fireEvent.click((await screen.findAllByTestId('grid-size-square'))[2 * 8 + 3]) // 3 x 4
        expect(savedMap()[0].length).toBe(4)
        undoKey()
        expect(savedMap()[0].length).toBe(3)
        expect(screen.getAllByTestId('challenge-cell').length).toBe(9)
    })
})
