import { Portal } from "@mui/material"
import gridStyles from "./Grid/grid.module.css"
import React, { useContext, useEffect, useRef, useState } from "react"
import { CreatorContext } from "../CreatorContext"
import { SceneMap } from "../../../serializedChallenge"
import { Position } from "./Grid/SceneCell"
import { applyTool, cellDragMode, MOVE_TOOL, MoveSelection, movePiece, moveToolTap, samePosition } from "./mapUtils"

/** Pointer movement (px) before a press becomes a drag. Below it, it's a regular tap/click. */
export const DRAG_THRESHOLD_PX = 6
/**
 * With touch, a drag starts only after holding still this long; moving earlier is a regular
 * scroll of the page. With mouse or pen the drag starts right away (after DRAG_THRESHOLD_PX).
 */
export const TOUCH_HOLD_MS = 250

export const CELL_ROW_ATTRIBUTE = 'data-cell-row'
export const CELL_COLUMN_ATTRIBUTE = 'data-cell-column'
export const SCENE_GRID_ATTRIBUTE = 'data-scene-grid'

type DragKind = 'tool' | 'paint' | 'move'

type Gesture = {
    kind: DragKind
    piece: string
    image: string
    startX: number
    startY: number
    active: boolean
    over: Position | null
    from?: Position
    lastCell?: Position
    map?: SceneMap
    touch: boolean
    holdTimer?: ReturnType<typeof setTimeout>
}

export type DragView = {
    kind: DragKind
    image: string
    x: number
    y: number
    over: Position | null
    /** Moving a piece outside the board: dropping it there removes it. */
    outside: boolean
}

type SceneDragContextType = {
    drag: DragView | null
    startToolDrag: (event: React.PointerEvent, tool: string, image: string) => void
    startCellDrag: (event: React.PointerEvent, position: Position, content: string, imagePath: string) => void
    /** True (once) right after a drag ended, so the click that browsers may fire afterwards is ignored. */
    shouldIgnoreClick: () => boolean
    /** Piece picked with the Move tool (tap or Enter), waiting for its destination. */
    moveSelection: MoveSelection | null
    /** A tap / Enter on a cell with the Move tool: pick, drop or move (see moveToolTap). */
    moveTap: (position: Position) => void
    cancelMove: () => void
    /**
     * Abandons the press in progress (a second finger started a pinch): nothing more is painted or
     * moved, and the click that may follow is ignored. A paint stroke keeps what it already painted.
     */
    cancelGesture: () => void
}

export const SceneDragContext = React.createContext<SceneDragContextType>({
    drag: null,
    startToolDrag: () => { },
    startCellDrag: () => { },
    shouldIgnoreClick: () => false,
    moveSelection: null,
    moveTap: () => { },
    cancelMove: () => { },
    cancelGesture: () => { }
})

export const useSceneDrag = () => useContext(SceneDragContext)

type PointAnalysis = { cell: Position | null, insideGrid: boolean }

/**
 * Finds the cell under a viewport point. Uses elementFromPoint because with touch the pointer
 * events keep targeting the element where the gesture started.
 */
export const cellAtPoint = (x: number, y: number): PointAnalysis => {
    const element = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) as HTMLElement | null : null
    const cellElement = element?.closest?.(`[${CELL_ROW_ATTRIBUTE}]`)
    const insideGrid = !!element?.closest?.(`[${SCENE_GRID_ATTRIBUTE}]`)
    if (!cellElement) return { cell: null, insideGrid }
    return {
        cell: {
            row: Number(cellElement.getAttribute(CELL_ROW_ATTRIBUTE)),
            column: Number(cellElement.getAttribute(CELL_COLUMN_ATTRIBUTE))
        },
        insideGrid
    }
}

/** Cells crossed by a straight line between two cells, so fast strokes don't skip any. */
export const cellsBetween = (from: Position, to: Position): Position[] => {
    const steps = Math.max(Math.abs(to.row - from.row), Math.abs(to.column - from.column))
    const cells: Position[] = []
    for (let step = 1; step <= steps; step++) {
        cells.push({
            row: Math.round(from.row + (to.row - from.row) * step / steps),
            column: Math.round(from.column + (to.column - from.column) * step / steps)
        })
    }
    return cells
}

const isPrimaryButton = (event: React.PointerEvent) => event.button === undefined || event.button === 0

const isTouch = (event: React.PointerEvent) => event.pointerType === 'touch'

export const SceneDragProvider = ({ children }: { children: React.ReactNode }) => {
    const creator = useContext(CreatorContext)
    const latest = useRef(creator)
    latest.current = creator

    const gesture = useRef<Gesture | null>(null)
    const [drag, setDrag] = useState<DragView | null>(null)
    const listeners = useRef<(() => void) | null>(null)
    const ignoreNextClick = useRef(false)
    const [moveSelection, setMoveSelection] = useState<MoveSelection | null>(null)

    // The picked piece is dropped when the tool or the scenario changes.
    useEffect(() => setMoveSelection(null), [creator.selectedTool, creator.index])

    // Escape cancels a picked piece (wherever the focus is).
    useEffect(() => {
        if (!moveSelection) return
        const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoveSelection(null) }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [moveSelection])

    const moveTap = (position: Position) => {
        const { currentMap, setCurrentMap } = latest.current
        const result = moveToolTap(currentMap, moveSelection, position)
        if (result.map) setCurrentMap(result.map)
        setMoveSelection(result.selection)
    }

    const stopListening = () => {
        listeners.current?.()
        listeners.current = null
    }

    useEffect(() => stopListening, [])

    const finish = () => {
        if (gesture.current?.holdTimer) clearTimeout(gesture.current.holdTimer)
        if (gesture.current?.active) {
            ignoreNextClick.current = true
            if (gesture.current.kind === 'paint') latest.current.endHistoryBatch()
        }
        gesture.current = null
        setDrag(null)
        stopListening()
    }

    const onMove = (event: PointerEvent) => {
        const current = gesture.current
        if (!current) return
        if (!current.active) {
            const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY)
            if (!(distance >= DRAG_THRESHOLD_PX)) return
            // Touch moved before the hold time: it's a scroll, let the browser have it.
            if (current.touch) return finish()
            activate(current)
        }
        event.preventDefault?.()
        const point = cellAtPoint(event.clientX, event.clientY)
        current.over = point.cell
        if (current.kind === 'paint' && current.over && !samePosition(current.over, current.lastCell)) {
            paint(current, cellsBetween(current.lastCell!, current.over))
            current.lastCell = current.over
        }
        setDrag({
            kind: current.kind, image: current.image, x: event.clientX, y: event.clientY, over: current.over,
            outside: current.kind === 'move' && !point.insideGrid
        })
    }

    const activate = (current: Gesture) => {
        current.active = true
        if (current.kind === 'paint') {
            latest.current.beginHistoryBatch()
            paint(current, [current.from!])
        }
        setDrag({ kind: current.kind, image: current.image, x: current.startX, y: current.startY, over: current.kind === 'paint' ? current.from! : null, outside: false })
    }

    const paint = (current: Gesture, cells: Position[]) => {
        current.map = cells.reduce((map, cell) => applyTool(map, current.piece, cell), current.map || latest.current.currentMap)
        latest.current.setCurrentMap(current.map)
    }

    const onUp = (event: PointerEvent) => {
        const current = gesture.current
        const { currentMap, setCurrentMap, setSelectedTool } = latest.current
        if (current?.active && current.kind === 'tool') {
            const target = cellAtPoint(event.clientX, event.clientY).cell
            if (target) {
                setCurrentMap(applyTool(currentMap, current.piece, target))
                setSelectedTool(current.piece)
            }
        }
        if (current?.active && current.kind === 'move') {
            const { cell, insideGrid } = cellAtPoint(event.clientX, event.clientY)
            // On a cell: move there. Outside the board: remove. On the board but between cells: nothing.
            if (cell || !insideGrid) setCurrentMap(movePiece(currentMap, current.from!, current.piece, cell))
            setMoveSelection(null)
        }
        finish()
    }

    const onCancel = () => finish()

    // Once a touch drag is active, stop the page from scrolling (touch-action stays scroll-friendly).
    const onTouchMove = (event: TouchEvent) => { if (gesture.current?.active) event.preventDefault() }
    // Long press would open the context menu / image callout on touch devices.
    const onContextMenu = (event: Event) => { if (gesture.current?.touch) event.preventDefault() }

    const listen = (current: Gesture) => {
        stopListening()
        gesture.current = current
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onCancel)
        window.addEventListener('touchmove', onTouchMove, { passive: false })
        window.addEventListener('contextmenu', onContextMenu)
        listeners.current = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onCancel)
            window.removeEventListener('touchmove', onTouchMove)
            window.removeEventListener('contextmenu', onContextMenu)
        }
        if (current.touch) {
            current.holdTimer = setTimeout(() => {
                if (gesture.current === current && !current.active) activate(current)
            }, TOUCH_HOLD_MS)
        }
    }

    const startCellDrag = (event: React.PointerEvent, position: Position, content: string, imagePath: string) => {
        if (!isPrimaryButton(event)) return
        ignoreNextClick.current = false
        const dragMode = cellDragMode(content, latest.current.selectedTool)
        if (dragMode.mode === 'none') return // Move tool on an empty cell: never paints
        const common = { startX: event.clientX, startY: event.clientY, active: false, over: null, from: position, lastCell: position, touch: isTouch(event) }
        listen(dragMode.mode === 'move'
            ? { ...common, kind: 'move', piece: dragMode.piece, image: `${imagePath}/${dragMode.piece}.png` }
            : { ...common, kind: 'paint', piece: latest.current.selectedTool, image: '' })
    }

    const shouldIgnoreClick = () => {
        const ignore = ignoreNextClick.current
        ignoreNextClick.current = false
        return ignore
    }

    const cancelGesture = () => {
        if (!gesture.current) return
        finish()
        ignoreNextClick.current = true
    }

    const startToolDrag = (event: React.PointerEvent, tool: string, image: string) => {
        if (!isPrimaryButton(event) || tool === MOVE_TOOL) return
        ignoreNextClick.current = false
        listen({ kind: 'tool', piece: tool, image, startX: event.clientX, startY: event.clientY, active: false, over: null, touch: isTouch(event) })
    }

    return <SceneDragContext.Provider value={{ drag, startToolDrag, startCellDrag, shouldIgnoreClick, moveSelection, moveTap, cancelMove: () => setMoveSelection(null), cancelGesture }}>
        {children}
        {drag && drag.kind !== 'paint' && <DragGhost drag={drag} />}
    </SceneDragContext.Provider>
}

const GHOST_SIZE_PX = 56

const DragGhost = ({ drag }: { drag: DragView }) =>
    <Portal>
        <img
            data-testid="drag-ghost"
            className={gridStyles['ghost-pop']}
            src={drag.image}
            alt=""
            aria-hidden
            draggable={false}
            style={{
                position: 'fixed',
                left: drag.x - GHOST_SIZE_PX / 2,
                top: drag.y - GHOST_SIZE_PX / 2,
                width: GHOST_SIZE_PX,
                height: GHOST_SIZE_PX,
                objectFit: 'contain',
                pointerEvents: 'none',
                opacity: drag.outside ? 0.35 : 0.85,
                zIndex: 2000,
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))'
            }} />
    </Portal>
