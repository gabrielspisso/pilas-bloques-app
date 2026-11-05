import { readFileSync } from 'fs'
import { join } from 'path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { SceneEdition } from '../../../../components/creator/Editor/SceneEdition/SceneEdition'
import { UndoRedoButtons } from '../../../../components/creator/Editor/EditorSubHeader/UndoRedoButtons'
import { MOVE_TOOL, OBSTACLE } from '../../../../components/creator/Editor/SceneEdition/mapUtils'
import { fluidGridStyle } from '../../../../components/creator/Editor/SceneEdition/Grid/SceneGrid'
import {
    anchoredScrollDelta, boardFraction, canZoomIn, canZoomOut, clampZoom, distance, MAX_ZOOM, midpoint, MIN_ZOOM, panScroll,
    pinchZoom, wheelDeltaPixels, wheelZoom, zoomedCellSize, zoomIn, zoomOut, zoomPercent
} from '../../../../components/creator/Editor/SceneEdition/Grid/boardZoom'

const css = readFileSync(join(__dirname, '../../../../components/creator/Editor/SceneEdition/Grid/grid.module.css'), 'utf8')
const rule = (selector: string) => css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1] || ''

describe('board zoom (pure)', () => {
    test('limits, steps and rounding', () => {
        expect(MIN_ZOOM).toBe(1)
        expect(MAX_ZOOM).toBe(3)
        expect(clampZoom(0.2)).toBe(1)
        expect(clampZoom(10)).toBe(3)
        expect(clampZoom(NaN)).toBe(1)
        expect(clampZoom(1.011)).toBe(1) // snapped
        expect(zoomIn(1)).toBe(1.25)
        expect(zoomOut(1.25)).toBe(1)
        expect(zoomOut(1)).toBe(1)
        // steps in, then back out, end at exactly 1 and 3
        let z = 1
        for (let i = 0; i < 10; i++) z = zoomIn(z)
        expect(z).toBe(3)
        for (let i = 0; i < 10; i++) z = zoomOut(z)
        expect(z).toBe(1)
        expect(canZoomIn(3)).toBe(false)
        expect(canZoomOut(1)).toBe(false)
        expect(canZoomIn(1) && canZoomOut(2)).toBe(true)
        expect(zoomPercent(1.25)).toBe(125)
    })

    test('wheel: up zooms in, down zooms out, lines and pages count as pixels', () => {
        expect(wheelZoom(1, -100)).toBeGreaterThan(1)
        expect(wheelZoom(2, 100)).toBeLessThan(2)
        expect(wheelZoom(1, 100)).toBe(1)
        expect(wheelDeltaPixels(3, 1)).toBe(48)
        expect(wheelDeltaPixels(1, 2)).toBe(400)
        expect(wheelZoom(1, -3, 1)).toBe(wheelZoom(1, -48, 0))
    })

    test('pinch: proportional to the distance between fingers', () => {
        expect(distance({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(50)
        expect(midpoint({ x: 0, y: 10 }, { x: 20, y: 30 })).toEqual({ x: 10, y: 20 })
        expect(pinchZoom(1, 100, 200)).toBe(2)
        expect(pinchZoom(2, 100, 50)).toBe(1)
        expect(pinchZoom(1, 100, 1000)).toBe(3)
        expect(pinchZoom(1.5, 0, 100)).toBe(1.5)
    })

    test('the zoom multiplies the cell size that fits (44 to 150 px) and keeps it a layout size', () => {
        expect(zoomedCellSize(100, 1.25)).toBe(125)
        expect(zoomedCellSize(null, 2)).toBeNull()
        expect(fluidGridStyle({ width: 300, height: 300 }, 3, 3, 2)).toEqual({ width: '600px' })
        expect(fluidGridStyle({ width: 300, height: 300 }, 3, 3)).toEqual({ width: '300px' })
        expect(fluidGridStyle(null, 3, 3, 1.5)).toEqual({ width: '150%' })
        expect(fluidGridStyle(null, 3, 3)).toEqual({ width: '100%' })
    })

    test('the point under the anchor stays there after zooming', () => {
        // Board 300 px wide starting at x = 50; the pointer at x = 200 is at half the board.
        const fraction = boardFraction(200, 50, 300)
        expect(fraction).toBe(0.5)
        // After zooming 2x the board is 600 px and (before scrolling) starts at 50: the point is at 350,
        // so the viewport must scroll 150 px to bring it back to 200.
        expect(anchoredScrollDelta(fraction, 50, 600, 200)).toBe(150)
        // Zooming out, it scrolls back
        expect(anchoredScrollDelta(0.5, -100, 300, 200)).toBe(-150)
        expect(boardFraction(0, 50, 300)).toBe(0) // clamped
        expect(boardFraction(10, 0, 0)).toBe(0.5)
    })

    test('panning moves the scroll opposite to the pointer', () => {
        expect(panScroll({ x: 100, y: 50 }, { x: 10, y: 10 }, { x: 40, y: 0 })).toEqual({ x: 70, y: 60 })
    })

    test('the viewport lets one finger scroll and keeps two-finger zoom for the board', () => {
        expect(rule('.board-viewport')).toMatch(/touch-action:\s*pan-x pan-y/)
        expect(rule('.board-viewport')).toMatch(/overflow:\s*auto/)
    })
})

// jsdom has neither PointerEvent nor layout (see SceneDrag.test.tsx).
const pointer = (type: string, target: EventTarget, x: number, y: number, extra: Record<string, unknown> = {}) =>
    act(() => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...extra })
        if (extra.pointerType) Object.defineProperty(event, 'pointerType', { value: extra.pointerType })
        target.dispatchEvent(event)
    })

const touchEvent = (type: string, target: EventTarget, points: { x: number, y: number }[]) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'touches', { value: points.map(p => ({ clientX: p.x, clientY: p.y })) })
    act(() => { target.dispatchEvent(event) })
    return event
}

let elementUnderPointer: Element | null = null

describe('board zoom and pan (behavior)', () => {
    beforeAll(() => i18n.loadNamespaces(['creator']))
    beforeEach(() => {
        LocalStorage.saveCreatorChallenge(defaultChallenge('Lita'))
        elementUnderPointer = null
        document.elementFromPoint = jest.fn(() => elementUnderPointer)
    })
    afterEach(() => {
        jest.useRealTimers()
        localStorage.clear()
    })

    const savedChallengeJson = () => JSON.stringify(LocalStorage.getCreatorChallenge())
    const savedMap = () => LocalStorage.getCreatorChallenge()!.scene.maps[0]
    const cellAt = (row: number, column: number) => screen.getAllByTestId('challenge-cell')[row * 3 + column]
    const grid = () => screen.getByTestId('dummy-test-scene-grid')
    const viewport = () => screen.getByTestId('board-viewport')

    const renderEditor = async (tool = OBSTACLE) => {
        render(<I18nextProvider i18n={i18n}>
            <CreatorContextProvider defaultSelectedTool={tool}>
                <SceneEdition />
                <UndoRedoButtons />
            </CreatorContextProvider>
        </I18nextProvider>)
        await screen.findByTestId('undo-button')
    }

    test('buttons zoom in, out and reset; the challenge and the undo history do not change', async () => {
        await renderEditor()
        const before = savedChallengeJson()
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('100 %')
        expect(screen.getByTestId('zoom-out')).toBeDisabled()
        expect(screen.getByTestId('zoom-reset')).toBeDisabled()

        fireEvent.click(screen.getByTestId('zoom-in'))
        fireEvent.click(screen.getByTestId('zoom-in'))
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('156 %')
        expect(grid().style.width).toBe('156%') // jsdom can't measure: the width is relative
        expect(screen.getByTestId('zoom-out')).not.toBeDisabled()

        fireEvent.click(screen.getByTestId('zoom-out'))
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('125 %')
        fireEvent.click(screen.getByTestId('zoom-reset'))
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('100 %')
        expect(grid().style.width).toBe('100%')

        expect(savedChallengeJson()).toBe(before)
        expect(screen.getByTestId('undo-button')).toBeDisabled()
    })

    test('the buttons have accessible names and stop at 300 %', async () => {
        await renderEditor()
        expect(screen.getByRole('group', { name: /zoom del tablero/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /acercar/i })).toBe(screen.getByTestId('zoom-in'))
        expect(screen.getByRole('button', { name: /alejar/i })).toBe(screen.getByTestId('zoom-out'))
        expect(screen.getByRole('button', { name: /restablecer/i })).toBe(screen.getByTestId('zoom-reset'))
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByTestId('zoom-in'))
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('300 %')
        expect(screen.getByTestId('zoom-in')).toBeDisabled()
    })

    test('Ctrl/Cmd + wheel zooms (and prevents the page zoom); a plain wheel only scrolls', async () => {
        await renderEditor()
        const plain = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -200 })
        act(() => { viewport().dispatchEvent(plain) })
        expect(plain.defaultPrevented).toBe(false)
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('100 %')

        const withCtrl = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -200, ctrlKey: true })
        act(() => { viewport().dispatchEvent(withCtrl) })
        expect(withCtrl.defaultPrevented).toBe(true)
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('149 %')

        const withMeta = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 400, metaKey: true })
        act(() => { viewport().dispatchEvent(withMeta) })
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('100 %')
    })

    test('pinch with two fingers zooms; the second finger cancels the pending piece drag', async () => {
        await renderEditor()
        jest.useFakeTimers()
        const before = JSON.stringify(savedMap())
        // first finger on a cell (a drag would start after holding 250 ms)
        pointer('pointerdown', cellAt(1, 1), 100, 100, { pointerType: 'touch' })
        const start = touchEvent('touchstart', cellAt(1, 1), [{ x: 100, y: 100 }, { x: 200, y: 100 }])
        expect(start.defaultPrevented).toBe(true)
        act(() => { jest.advanceTimersByTime(400) })
        expect(screen.queryByTestId('drag-ghost')).toBeNull()

        const move = touchEvent('touchmove', cellAt(1, 1), [{ x: 50, y: 100 }, { x: 250, y: 100 }])
        expect(move.defaultPrevented).toBe(true)
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('200 %')

        touchEvent('touchend', cellAt(1, 1), [])
        elementUnderPointer = cellAt(1, 2)
        pointer('pointermove', window, 250, 100, { pointerType: 'touch' })
        pointer('pointerup', window, 250, 100, { pointerType: 'touch' })
        fireEvent.click(cellAt(1, 1)) // a click after the gesture must not paint either
        expect(JSON.stringify(savedMap())).toBe(before)
    })

    test('one finger keeps the native scroll: its touchmove is not prevented', async () => {
        await renderEditor()
        touchEvent('touchstart', cellAt(0, 1), [{ x: 10, y: 10 }])
        const move = touchEvent('touchmove', cellAt(0, 1), [{ x: 10, y: 60 }])
        expect(move.defaultPrevented).toBe(false)
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('100 %')
    })

    test('after zooming, painting and moving pieces still work', async () => {
        await renderEditor()
        fireEvent.click(screen.getByTestId('zoom-in'))
        // paint a stroke with the mouse over three cells
        pointer('pointerdown', cellAt(2, 0), 0, 0)
        elementUnderPointer = cellAt(2, 1); pointer('pointermove', window, 40, 0)
        elementUnderPointer = cellAt(2, 2); pointer('pointermove', window, 80, 0)
        pointer('pointerup', window, 80, 0)
        expect(savedMap()[2]).toEqual([OBSTACLE, OBSTACLE, OBSTACLE])
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('125 %')
    })

    test('the Move tool still drags the character when zoomed', async () => {
        await renderEditor(MOVE_TOOL)
        fireEvent.click(screen.getByTestId('zoom-in'))
        pointer('pointerdown', cellAt(0, 0), 0, 0)
        elementUnderPointer = cellAt(1, 1); pointer('pointermove', window, 60, 60)
        pointer('pointerup', window, 60, 60)
        expect(savedMap()[0][0]).toBe('-')
        expect(savedMap()[1][1]).toBe('A')
    })

    test('mouse: middle button or the empty area around the cells pans; pressing a cell never pans', async () => {
        await renderEditor()
        const box = viewport()
        box.scrollLeft = 100
        box.scrollTop = 100
        pointer('pointerdown', box, 50, 50, { button: 1, pointerType: 'mouse' })
        pointer('pointermove', window, 20, 30, { pointerType: 'mouse' })
        pointer('pointerup', window, 20, 30, { pointerType: 'mouse' })
        expect([box.scrollLeft, box.scrollTop]).toEqual([130, 120])

        pointer('pointerdown', box, 0, 0, { button: 0, pointerType: 'mouse' })
        pointer('pointermove', window, 10, 10, { pointerType: 'mouse' })
        pointer('pointerup', window, 10, 10, { pointerType: 'mouse' })
        expect([box.scrollLeft, box.scrollTop]).toEqual([120, 110])

        pointer('pointerdown', cellAt(0, 1), 0, 0, { button: 0, pointerType: 'mouse' })
        elementUnderPointer = cellAt(0, 2)
        pointer('pointermove', window, 50, 50, { pointerType: 'mouse' })
        pointer('pointerup', window, 50, 50, { pointerType: 'mouse' })
        expect([box.scrollLeft, box.scrollTop]).toEqual([120, 110]) // painted instead
        expect(savedMap()[0][1]).toBe(OBSTACLE)
    })
})
