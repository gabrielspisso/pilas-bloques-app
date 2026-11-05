import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { SceneMap, defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { SceneEdition } from '../../../../components/creator/Editor/SceneEdition/SceneEdition'
import { UndoRedoButtons } from '../../../../components/creator/Editor/EditorSubHeader/UndoRedoButtons'
import { ACTOR, EMPTY, OBSTACLE, cellDragMode, movePiece } from '../../../../components/creator/Editor/SceneEdition/mapUtils'

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

    describe('painting by dragging', () => {
        const stroke = (cells: Element[]) => {
            pointer('pointerdown', cells[0], 0, 0)
            cells.forEach((c, i) => {
                over(c)
                pointer('pointermove', window, 40 * (i + 1), 0)
            })
            pointer('pointerup', window, 40 * cells.length, 0)
        }

        test('a stroke over three cells changes the three, and one undo reverts them together', async () => {
            await renderEditor(OBSTACLE)
            const before = JSON.stringify(savedMap())
            stroke([cellAt(1, 0), cellAt(1, 1), cellAt(1, 2)])
            expect(savedMap()[1]).toEqual([OBSTACLE, OBSTACLE, OBSTACLE])

            fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
            expect(JSON.stringify(savedMap())).toBe(before)
            expect(screen.getByTestId('undo-button')).toBeDisabled()

            fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })
            expect(savedMap()[1]).toEqual([OBSTACLE, OBSTACLE, OBSTACLE])
        })

        test('works with objects and fills cells skipped by a fast stroke', async () => {
            await renderEditor('L')
            pointer('pointerdown', cellAt(2, 0), 0, 0)
            over(cellAt(2, 2))
            pointer('pointermove', window, 200, 0)
            pointer('pointerup', window, 200, 0)
            expect(savedMap()[2]).toEqual(['L', 'L', 'L'])
        })

        test('keeps the actor rules: the actor at the initial cell is not painted over', async () => {
            await renderEditor(OBSTACLE)
            stroke([cellAt(1, 0), cellAt(0, 0), cellAt(0, 1)])
            expect(savedMap()[0]).toEqual([ACTOR, OBSTACLE, '-'])
            expect(savedMap()[1][0]).toBe(OBSTACLE)
        })

        test('the click fired after a stroke is ignored, the next one works', async () => {
            await renderEditor('L')
            stroke([cellAt(1, 0), cellAt(1, 1)])
            fireEvent.click(cellAt(2, 2)) // the click browsers may fire at the end of the stroke
            expect(savedMap()[2][2]).toBe('-')
            fireEvent.click(cellAt(2, 2))
            expect(savedMap()[2][2]).toBe('L')
        })
    })

    describe('moving placed pieces', () => {
        const saveMap = (map: SceneMap) => LocalStorage.saveCreatorChallenge({ ...defaultChallenge('Lita'), scene: { type: 'Lita', maps: [map] } })
        const drag = (from: Element, to: Element | null) => {
            pointer('pointerdown', from, 0, 0)
            over(to)
            pointer('pointermove', window, 80, 80)
            pointer('pointerup', window, 80, 80)
        }
        const actorCount = () => savedMap().flat().filter(c => c.split('&').includes(ACTOR)).length

        beforeEach(() => saveMap([[ACTOR, '-', '-'], ['-', 'L', '-'], ['-', '-', OBSTACLE]]))

        test('the actor can be dragged to another cell and there is still only one', async () => {
            await renderEditor(OBSTACLE)
            drag(cellAt(0, 0), cellAt(1, 2))
            expect(savedMap()[1][2]).toBe(ACTOR)
            expect(savedMap()[0][0]).toBe(EMPTY)
            expect(actorCount()).toBe(1)
        })

        test('an object dropped outside the board disappears, with a faded ghost while outside', async () => {
            await renderEditor(OBSTACLE)
            pointer('pointerdown', cellAt(1, 1), 0, 0)
            over(document.body)
            pointer('pointermove', window, 500, 500)
            expect(screen.getByTestId('drag-ghost').style.opacity).toBe('0.35')
            pointer('pointerup', window, 500, 500)
            expect(savedMap()[1][1]).toBe(EMPTY)
        })

        test('the actor dropped outside the board does not disappear: it goes back to the initial cell', async () => {
            saveMap([['-', '-', '-'], ['-', 'A&L', '-'], ['-', '-', '-']])
            await renderEditor(OBSTACLE)
            drag(cellAt(1, 1), document.body)
            expect(savedMap()[1][1]).toBe('L')
            expect(savedMap()[0][0]).toBe(ACTOR)
            expect(actorCount()).toBe(1)
        })

        test('an obstacle can not replace the actor at the initial cell: nothing changes', async () => {
            await renderEditor('L')
            const before = JSON.stringify(savedMap())
            drag(cellAt(2, 2), cellAt(0, 0))
            expect(JSON.stringify(savedMap())).toBe(before)
        })

        test('a move is a single undo step', async () => {
            await renderEditor(OBSTACLE)
            const before = JSON.stringify(savedMap())
            drag(cellAt(1, 1), cellAt(2, 0))
            expect(savedMap()[2][0]).toBe('L')
            expect(savedMap()[1][1]).toBe(EMPTY)
            fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
            expect(JSON.stringify(savedMap())).toBe(before)
        })

        test('dragging from a cell that already has the selected piece paints instead of moving', async () => {
            await renderEditor(OBSTACLE)
            pointer('pointerdown', cellAt(2, 2), 0, 0)
            over(cellAt(2, 1)); pointer('pointermove', window, 40, 0)
            over(cellAt(2, 0)); pointer('pointermove', window, 80, 0)
            pointer('pointerup', window, 80, 0)
            expect(savedMap()[2]).toEqual([OBSTACLE, OBSTACLE, OBSTACLE])
        })
    })

    describe('map rules (pure functions)', () => {
        test('cellDragMode', () => {
            expect(cellDragMode(EMPTY, OBSTACLE)).toEqual({ mode: 'paint' })
            expect(cellDragMode('L', EMPTY)).toEqual({ mode: 'paint' })
            expect(cellDragMode(OBSTACLE, OBSTACLE)).toEqual({ mode: 'paint' })
            expect(cellDragMode('A&L', 'L')).toEqual({ mode: 'paint' })
            expect(cellDragMode('A&L', OBSTACLE)).toEqual({ mode: 'move', piece: ACTOR })
            expect(cellDragMode(ACTOR, ACTOR)).toEqual({ mode: 'move', piece: ACTOR })
            expect(cellDragMode('L', OBSTACLE)).toEqual({ mode: 'move', piece: 'L' })
        })

        test('movePiece does not mutate its input and keeps the prize when the actor leaves', () => {
            const map = [['A&L', '-'], ['-', '-']]
            const moved = movePiece(map, { row: 0, column: 0 }, ACTOR, { row: 1, column: 1 })
            expect(moved).toEqual([['L', '-'], ['-', ACTOR]])
            expect(map).toEqual([['A&L', '-'], ['-', '-']])
        })

        test('movePiece of an object onto the actor keeps both', () => {
            expect(movePiece([[ACTOR, 'L']], { row: 0, column: 1 }, 'L', { row: 0, column: 0 })).toEqual([['A&L', EMPTY]])
        })
    })
})

