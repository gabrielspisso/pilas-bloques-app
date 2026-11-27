import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { SceneMap, defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { GridSizePicker, isInsideSize, sizeAfterKey } from '../../../../components/creator/Editor/SceneEdition/GridOptions/GridSizePicker'
import { UndoRedoButtons } from '../../../../components/creator/Editor/EditorSubHeader/UndoRedoButtons'
import { ACTOR, EMPTY, OBSTACLE, GRID_LIMITS, resizeMap } from '../../../../components/creator/Editor/SceneEdition/mapUtils'

// jsdom has no PointerEvent: a MouseEvent named pointer* with pointerType 'touch' (as in SceneDrag.test).
const touch = (type: string, target: EventTarget) =>
    act(() => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 })
        Object.defineProperty(event, 'pointerType', { value: 'touch' })
        target.dispatchEvent(event)
    })

const actorCount = (map: SceneMap) => map.flat().filter(cell => cell.split('&').includes(ACTOR)).length

describe('resizeMap (pure)', () => {
    const map: SceneMap = [
        [EMPTY, 'T', EMPTY],
        [OBSTACLE, EMPTY, EMPTY],
        [EMPTY, EMPTY, 'A&L']
    ]

    test('keeps the common area, discards the rest and adds empty cells', () => {
        expect(resizeMap(map, 2, 4)).toEqual([
            [ACTOR, 'T', EMPTY, EMPTY], // the actor was cut out: back to (0,0)
            [OBSTACLE, EMPTY, EMPTY, EMPTY]
        ])
    })

    test('does not mutate the input', () => {
        const copy = JSON.parse(JSON.stringify(map))
        resizeMap(map, 1, 1)
        resizeMap(map, 5, 5)
        expect(map).toEqual(copy)
    })

    test('never leaves the map without the actor nor with two', () => {
        for (let rows = 1; rows <= GRID_LIMITS.maxRows; rows++)
            for (let columns = 1; columns <= GRID_LIMITS.maxColumns; columns++)
                expect(actorCount(resizeMap(map, rows, columns))).toBe(1)
    })

    test('keeps the actor where it was when it stays inside', () => {
        const grown = resizeMap(map, 4, 4)
        expect(grown[2][2]).toBe('A&L')
        expect(grown[0][0]).toBe(EMPTY)
    })

    test('is clamped to 1..10 rows and 1..8 columns', () => {
        expect(resizeMap(map, 0, 0)).toEqual([[ACTOR]])
        const big = resizeMap(map, 20, 20)
        expect(big.length).toBe(10)
        expect(big[0].length).toBe(8)
    })
})

describe('picker helpers', () => {
    test('arrows change the size inside the limits', () => {
        expect(sizeAfterKey({ rows: 3, columns: 3 }, 'ArrowDown')).toEqual({ rows: 4, columns: 3 })
        expect(sizeAfterKey({ rows: 3, columns: 3 }, 'ArrowLeft')).toEqual({ rows: 3, columns: 2 })
        expect(sizeAfterKey({ rows: 1, columns: 1 }, 'ArrowUp')).toEqual({ rows: 1, columns: 1 })
        expect(sizeAfterKey({ rows: 10, columns: 8 }, 'ArrowRight')).toEqual({ rows: 10, columns: 8 })
        expect(sizeAfterKey({ rows: 3, columns: 3 }, 'a')).toBeNull()
    })

    test('highlights the rectangle from the top-left corner', () => {
        expect(isInsideSize(0, 0, { rows: 1, columns: 1 })).toBe(true)
        expect(isInsideSize(3, 2, { rows: 4, columns: 3 })).toBe(true)
        expect(isInsideSize(4, 2, { rows: 4, columns: 3 })).toBe(false)
        expect(isInsideSize(3, 3, { rows: 4, columns: 3 })).toBe(false)
    })
})

describe('GridSizePicker', () => {
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge('Lita')))
    afterEach(() => localStorage.clear())

    const savedMap = () => LocalStorage.getCreatorChallenge()!.scene.maps[0]

    const renderPicker = async () => {
        render(<I18nextProvider i18n={i18n}>
            <CreatorContextProvider>
                <GridSizePicker />
                <UndoRedoButtons />
            </CreatorContextProvider>
        </I18nextProvider>)
        return await screen.findByTestId('grid-size-button')
    }

    const squares = () => screen.getAllByTestId('grid-size-square')
    const square = (row: number, column: number) => squares()[row * GRID_LIMITS.maxColumns + column]
    const highlighted = () => squares().filter(element => element.getAttribute('aria-selected') === 'true').length

    test('the button shows rows × columns and opens a 10 x 8 board with the current size highlighted', async () => {
        const button = await renderPicker()
        expect(button).toHaveTextContent('3 × 3')
        expect(button).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(button)
        expect(squares().length).toBe(80)
        expect(highlighted()).toBe(9)
        expect(screen.getByTestId('grid-size-picker-value')).toHaveTextContent('3 × 3')
    })

    test('hovering highlights the rectangle and shows the size; clicking applies it and closes', async () => {
        fireEvent.click(await renderPicker())
        fireEvent.pointerMove(square(3, 2))
        expect(screen.getByTestId('grid-size-picker-value')).toHaveTextContent('4 × 3')
        expect(highlighted()).toBe(12)
        fireEvent.click(square(3, 2))
        expect(savedMap().length).toBe(4)
        expect(savedMap()[0].length).toBe(3)
        expect(screen.getByTestId('grid-size-button')).toHaveTextContent('4 × 3')
        await waitFor(() => expect(screen.queryByTestId('grid-size-picker')).toBeNull())
    })

    test('touch: dragging a finger and lifting it applies the size under the finger', async () => {
        fireEvent.click(await renderPicker())
        const picker = screen.getByTestId('grid-size-picker')
        const original = document.elementFromPoint
        document.elementFromPoint = jest.fn(() => square(1, 5))
        touch('pointerdown', square(0, 0))
        touch('pointermove', picker)
        expect(screen.getByTestId('grid-size-picker-value')).toHaveTextContent('2 × 6')
        touch('pointerup', picker)
        document.elementFromPoint = original
        expect(savedMap().length).toBe(2)
        expect(savedMap()[0].length).toBe(6)
    })

    test('keyboard: arrows change the size, Enter applies', async () => {
        const button = await renderPicker()
        fireEvent.click(button) // Enter / Space on a button fire click
        const picker = screen.getByTestId('grid-size-picker')
        expect(document.activeElement).toBe(picker)
        fireEvent.keyDown(picker, { key: 'ArrowDown' })
        fireEvent.keyDown(picker, { key: 'ArrowDown' })
        fireEvent.keyDown(picker, { key: 'ArrowLeft' })
        expect(screen.getByTestId('grid-size-picker-value')).toHaveTextContent('5 × 2')
        fireEvent.keyDown(picker, { key: 'Enter' })
        expect(savedMap().length).toBe(5)
        expect(savedMap()[0].length).toBe(2)
    })

    test('Escape cancels without changes', async () => {
        fireEvent.click(await renderPicker())
        const picker = screen.getByTestId('grid-size-picker')
        fireEvent.keyDown(picker, { key: 'ArrowDown' })
        fireEvent.keyDown(picker, { key: 'Escape' })
        await waitFor(() => expect(screen.queryByTestId('grid-size-picker')).toBeNull())
        expect(savedMap()).toEqual(defaultChallenge('Lita').scene.maps[0])
        expect(screen.getByTestId('grid-size-button')).toHaveTextContent('3 × 3')
    })

    test('shrinking discards pieces outside, relocates the actor, and the whole change is one undo step', async () => {
        const map: SceneMap = [
            ['-', 'T', '-'],
            ['O', '-', '-'],
            ['-', 'L', 'A']
        ]
        LocalStorage.saveCreatorChallenge({ ...defaultChallenge('Lita'), scene: { type: 'Lita', maps: [map] } })
        fireEvent.click(await renderPicker())
        fireEvent.click(square(1, 1)) // 2 x 2
        expect(savedMap()).toEqual([['A', 'T'], ['O', '-']])
        expect(actorCount(savedMap())).toBe(1)

        fireEvent.click(screen.getByTestId('undo-button'))
        expect(savedMap()).toEqual(map)
        fireEvent.click(screen.getByTestId('redo-button'))
        expect(savedMap()).toEqual([['A', 'T'], ['O', '-']])
    })

    test('choosing the same size changes nothing (no undo step)', async () => {
        fireEvent.click(await renderPicker())
        fireEvent.click(square(2, 2))
        expect(screen.getByTestId('undo-button')).toBeDisabled()
    })
})
