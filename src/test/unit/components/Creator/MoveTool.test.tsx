import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { SceneMap, defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { SceneEdition } from '../../../../components/creator/Editor/SceneEdition/SceneEdition'
import { UndoRedoButtons } from '../../../../components/creator/Editor/EditorSubHeader/UndoRedoButtons'
import { ACTOR, EMPTY, MOVE_TOOL, OBSTACLE, applyTool, cellDragMode, moveToolTap, pieceToMove } from '../../../../components/creator/Editor/SceneEdition/mapUtils'

// jsdom has neither PointerEvent nor layout (same helpers as SceneDrag.test).
const pointer = (type: string, target: EventTarget, x: number, y: number) =>
    act(() => { target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })) })

const touch = (type: string, target: EventTarget, x: number, y: number) =>
    act(() => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
        Object.defineProperty(event, 'pointerType', { value: 'touch' })
        target.dispatchEvent(event)
    })

const actorCount = (map: SceneMap) => map.flat().filter(cell => cell.split('&').includes(ACTOR)).length

const board: SceneMap = [
    [ACTOR, EMPTY, 'T'],
    [EMPTY, OBSTACLE, EMPTY],
    [EMPTY, EMPTY, 'L']
]

describe('Move tool: pure rules', () => {
    test('the Move tool never paints', () => {
        expect(applyTool(board, MOVE_TOOL, { row: 1, column: 0 })).toEqual(board)
        expect(cellDragMode(EMPTY, MOVE_TOOL)).toEqual({ mode: 'none' })
        expect(cellDragMode('A&T', MOVE_TOOL)).toEqual({ mode: 'move', piece: ACTOR })
        expect(cellDragMode('T', MOVE_TOOL)).toEqual({ mode: 'move', piece: 'T' })
    })

    test('pieceToMove picks the actor first', () => {
        expect(pieceToMove('A&T')).toBe(ACTOR)
        expect(pieceToMove('T')).toBe('T')
        expect(pieceToMove(EMPTY)).toBeNull()
    })

    test('tap: pick, move, drop in place, empty cell, invalid destination', () => {
        const picked = moveToolTap(board, null, { row: 0, column: 2 })
        expect(picked).toEqual({ map: null, selection: { position: { row: 0, column: 2 }, piece: 'T' } })

        const moved = moveToolTap(board, picked.selection, { row: 2, column: 0 })
        expect(moved.selection).toBeNull()
        expect(moved.map![2][0]).toBe('T')
        expect(moved.map![0][2]).toBe(EMPTY)

        expect(moveToolTap(board, picked.selection, { row: 0, column: 2 })).toEqual({ map: null, selection: null })
        expect(moveToolTap(board, null, { row: 1, column: 0 })).toEqual({ map: null, selection: null })

        // An obstacle can not replace the actor at the initial cell: nothing changes, it stays picked.
        const obstacle = { position: { row: 1, column: 1 }, piece: OBSTACLE }
        expect(moveToolTap(board, obstacle, { row: 0, column: 0 })).toEqual({ map: null, selection: obstacle })
    })

    test('the actor is never duplicated nor lost', () => {
        const actor = moveToolTap(board, null, { row: 0, column: 0 }).selection
        const moved = moveToolTap(board, actor, { row: 2, column: 2 }).map!
        expect(moved[2][2]).toBe('A&L')
        expect(actorCount(moved)).toBe(1)
    })

    test('a stale selection (the piece is no longer there) picks again instead of moving', () => {
        const stale = { position: { row: 1, column: 0 }, piece: 'T' }
        expect(moveToolTap(board, stale, { row: 0, column: 2 })).toEqual({ map: null, selection: { position: { row: 0, column: 2 }, piece: 'T' } })
    })
})

describe('Move tool in the editor', () => {
    let elementUnderPointer: Element | null = null

    beforeEach(() => {
        LocalStorage.saveCreatorChallenge({ ...defaultChallenge('Lita'), scene: { type: 'Lita', maps: [board.map(row => row.slice())] } })
        elementUnderPointer = null
        document.elementFromPoint = jest.fn(() => elementUnderPointer)
    })
    afterEach(() => localStorage.clear())

    const savedMap = () => LocalStorage.getCreatorChallenge()!.scene.maps[0]
    const cellAt = (row: number, column: number) => screen.getAllByTestId('challenge-cell')[row * 3 + column]
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

    test('the Move tool is the first of the palette, with a label, and "Mover a Lita" is still there', async () => {
        await renderEditor()
        const tools = screen.getByTestId('scene-tools').querySelectorAll('button')
        expect(tools[0]).toBe(screen.getByTestId(MOVE_TOOL))
        expect(screen.getByTestId(MOVE_TOOL)).toHaveAttribute('aria-label')
        expect(screen.getByTestId(MOVE_TOOL).querySelector('svg')).not.toBeNull()
        expect(tools[1]).toBe(screen.getByTestId(ACTOR))
        fireEvent.click(screen.getByTestId(MOVE_TOOL))
        expect(screen.getByTestId(MOVE_TOOL)).toHaveAttribute('aria-pressed', 'true')
    })

    test('tap a piece (outlined), tap another cell: it moves there; one undo step', async () => {
        await renderEditor(MOVE_TOOL)
        fireEvent.click(cellAt(0, 2))
        expect(cellAt(0, 2)).toHaveAttribute('aria-selected', 'true')
        expect(cellAt(0, 2).style.outline).toContain('dashed')
        expect(screen.getByTestId('move-status').textContent).not.toBe('')

        fireEvent.click(cellAt(2, 0))
        expect(savedMap()[2][0]).toBe('T')
        expect(savedMap()[0][2]).toBe(EMPTY)
        expect(cellAt(2, 0)).toHaveAttribute('aria-selected', 'false')

        fireEvent.click(screen.getByTestId('undo-button'))
        expect(savedMap()).toEqual(board)
    })

    test('tapping the picked piece again or pressing Escape deselects it', async () => {
        await renderEditor(MOVE_TOOL)
        fireEvent.click(cellAt(0, 2))
        fireEvent.click(cellAt(0, 2))
        expect(cellAt(0, 2)).toHaveAttribute('aria-selected', 'false')

        fireEvent.click(cellAt(0, 2))
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(cellAt(0, 2)).toHaveAttribute('aria-selected', 'false')
        expect(savedMap()).toEqual(board)
    })

    test('never paints nor places new pieces: tapping and dragging over empty cells changes nothing', async () => {
        await renderEditor(MOVE_TOOL)
        fireEvent.click(cellAt(1, 0))
        pointer('pointerdown', cellAt(1, 2), 0, 0)
        over(cellAt(2, 1))
        pointer('pointermove', window, 50, 50)
        pointer('pointerup', window, 50, 50)
        expect(savedMap()).toEqual(board)
    })

    test('the cursor shows what can be moved', async () => {
        await renderEditor(MOVE_TOOL)
        expect(cellAt(0, 2).style.cursor).toBe('grab')
        expect(cellAt(1, 0).style.cursor).toBe('default')
        fireEvent.click(cellAt(0, 2))
        expect(cellAt(1, 0).style.cursor).toBe('move')
    })

    test('drag with the mouse: same rules as the drag of batch 1 (dropped outside the board it is removed)', async () => {
        await renderEditor(MOVE_TOOL)
        pointer('pointerdown', cellAt(2, 2), 0, 0)
        over(cellAt(1, 0))
        pointer('pointermove', window, 40, 40)
        pointer('pointerup', window, 40, 40)
        expect(savedMap()[1][0]).toBe('L')
        expect(savedMap()[2][2]).toBe(EMPTY)

        pointer('pointerdown', cellAt(1, 0), 0, 0)
        over(document.body)
        pointer('pointermove', window, 400, 400)
        pointer('pointerup', window, 400, 400)
        expect(savedMap()[1][0]).toBe(EMPTY)
        expect(actorCount(savedMap())).toBe(1)
    })

    test('drag with touch after holding still', async () => {
        jest.useFakeTimers()
        try {
            await renderEditor(MOVE_TOOL)
            touch('pointerdown', cellAt(0, 0), 0, 0)
            act(() => { jest.advanceTimersByTime(300) })
            over(cellAt(2, 1))
            touch('pointermove', window, 0, 80)
            touch('pointerup', window, 0, 80)
            expect(savedMap()[2][1]).toBe(ACTOR)
            expect(actorCount(savedMap())).toBe(1)
        } finally {
            jest.useRealTimers()
        }
    })

    test('keyboard: Enter picks, arrows choose the destination, Enter drops; Escape cancels', async () => {
        await renderEditor(MOVE_TOOL)
        const grid = screen.getByRole('grid')
        act(() => cellAt(0, 0).focus())
        fireEvent.keyDown(cellAt(0, 0), { key: 'ArrowRight' })
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
        fireEvent.keyDown(document.activeElement!, { key: 'Enter' }) // picks the tomato at (0,2)
        expect(cellAt(0, 2)).toHaveAttribute('aria-selected', 'true')
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
        fireEvent.keyDown(document.activeElement!, { key: 'Enter' }) // drops it at (1,2)
        expect(savedMap()[1][2]).toBe('T')
        expect(savedMap()[0][2]).toBe(EMPTY)

        fireEvent.keyDown(document.activeElement!, { key: 'Enter' }) // picks it again
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
        fireEvent.keyDown(grid, { key: 'Escape' })
        fireEvent.keyDown(document.activeElement!, { key: 'Enter' }) // nothing picked, (1,1) has an obstacle: picks it
        expect(savedMap()[1][2]).toBe('T')
        expect(cellAt(1, 1)).toHaveAttribute('aria-selected', 'true')
    })

    test('changing the tool drops the picked piece', async () => {
        await renderEditor(MOVE_TOOL)
        fireEvent.click(cellAt(0, 2))
        fireEvent.click(screen.getByTestId(OBSTACLE))
        expect(cellAt(0, 2)).not.toHaveAttribute('aria-selected')
        fireEvent.click(screen.getByTestId(MOVE_TOOL))
        expect(cellAt(0, 2)).toHaveAttribute('aria-selected', 'false')
    })
})
