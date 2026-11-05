import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { SceneEdition } from '../../../../components/creator/Editor/SceneEdition/SceneEdition'
import { UndoRedoButtons } from '../../../../components/creator/Editor/EditorSubHeader/UndoRedoButtons'
import { ACTOR, OBSTACLE } from '../../../../components/creator/Editor/SceneEdition/mapUtils'

// jsdom has neither PointerEvent nor layout: pointer events are MouseEvents with pointer names,
// and elementFromPoint is mocked to say what is under the pointer.
const pointer = (type: string, target: EventTarget, x: number, y: number) =>
    act(() => { target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })) })

let elementUnderPointer: Element | null = null

describe('Scene drag and drop', () => {
    beforeEach(() => {
        LocalStorage.saveCreatorChallenge(defaultChallenge('Lita'))
        elementUnderPointer = null
        document.elementFromPoint = jest.fn(() => elementUnderPointer)
    })
    afterEach(() => localStorage.clear())

    const savedMap = () => LocalStorage.getCreatorChallenge()!.scene.maps[0]
    const cell = (n: number) => screen.getAllByTestId('challenge-cell')[n]
    const cellAt = (row: number, column: number) => cell(row * 3 + column)
    const over = (element: Element | null) => { elementUnderPointer = element }

    const renderEditor = async (tool = ACTOR) => {
        render(<I18nextProvider i18n={i18n}>
            <CreatorContextProvider defaultSelectedTool={tool}>
                <SceneEdition />
                <UndoRedoButtons />
            </CreatorContextProvider>
        </I18nextProvider>)
        await screen.findByTestId('undo-button')
    }

    describe('from the palette', () => {
        test('dropping a tool on a cell places it there, with ghost and highlighted target while dragging', async () => {
            await renderEditor()
            pointer('pointerdown', screen.getByTestId(OBSTACLE), 0, 0)

            over(cellAt(1, 1))
            pointer('pointermove', window, 60, 60)
            expect(screen.getByTestId('drag-ghost')).toBeInTheDocument()
            expect(cellAt(1, 1).style.outline).toContain('solid')
            expect(cellAt(1, 2).style.outline).toBe('')

            pointer('pointerup', window, 60, 60)
            expect(savedMap()[1][1]).toBe(OBSTACLE)
            expect(screen.queryByTestId('drag-ghost')).toBeNull()
        })

        test('dropping outside the board changes nothing', async () => {
            await renderEditor()
            const before = JSON.stringify(savedMap())
            pointer('pointerdown', screen.getByTestId('L'), 0, 0)
            over(document.body)
            pointer('pointermove', window, 80, 0)
            pointer('pointerup', window, 80, 0)
            expect(JSON.stringify(savedMap())).toBe(before)
        })

        test('a press without movement is not a drag', async () => {
            await renderEditor()
            pointer('pointerdown', screen.getByTestId(OBSTACLE), 10, 10)
            over(cellAt(2, 2))
            pointer('pointermove', window, 12, 11)
            pointer('pointerup', window, 12, 11)
            expect(screen.queryByTestId('drag-ghost')).toBeNull()
            expect(savedMap()[2][2]).toBe('-')
        })

        test('the drop follows the existing tool rules (actor at the initial cell is kept)', async () => {
            await renderEditor()
            pointer('pointerdown', screen.getByTestId(OBSTACLE), 0, 0)
            over(cellAt(0, 0))
            pointer('pointermove', window, 50, 50)
            pointer('pointerup', window, 50, 50)
            expect(savedMap()[0][0]).toBe(ACTOR)
        })

        test('tap a tool then tap a cell still works', async () => {
            await renderEditor()
            fireEvent.click(screen.getByTestId('L'))
            fireEvent.click(cellAt(2, 0))
            expect(savedMap()[2][0]).toBe('L')
        })
    })
})
