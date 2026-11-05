import { Portal } from "@mui/material"
import React, { useContext, useEffect, useRef, useState } from "react"
import { CreatorContext } from "../CreatorContext"
import { Position } from "./Grid/SceneCell"
import { applyTool } from "./mapUtils"

/** Pointer movement (px) before a press becomes a drag. Below it, it's a regular tap/click. */
export const DRAG_THRESHOLD_PX = 6

export const CELL_ROW_ATTRIBUTE = 'data-cell-row'
export const CELL_COLUMN_ATTRIBUTE = 'data-cell-column'
export const SCENE_GRID_ATTRIBUTE = 'data-scene-grid'

type DragKind = 'tool'

type Gesture = {
    kind: DragKind
    piece: string
    image: string
    startX: number
    startY: number
    active: boolean
    over: Position | null
}

export type DragView = {
    kind: DragKind
    image: string
    x: number
    y: number
    over: Position | null
}

type SceneDragContextType = {
    drag: DragView | null
    startToolDrag: (event: React.PointerEvent, tool: string, image: string) => void
}

export const SceneDragContext = React.createContext<SceneDragContextType>({
    drag: null,
    startToolDrag: () => { }
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

const isPrimaryButton = (event: React.PointerEvent) => event.button === undefined || event.button === 0

export const SceneDragProvider = ({ children }: { children: React.ReactNode }) => {
    const creator = useContext(CreatorContext)
    const latest = useRef(creator)
    latest.current = creator

    const gesture = useRef<Gesture | null>(null)
    const [drag, setDrag] = useState<DragView | null>(null)
    const listeners = useRef<(() => void) | null>(null)

    const stopListening = () => {
        listeners.current?.()
        listeners.current = null
    }

    useEffect(() => stopListening, [])

    const finish = () => {
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
            current.active = true
        }
        event.preventDefault?.()
        current.over = cellAtPoint(event.clientX, event.clientY).cell
        setDrag({ kind: current.kind, image: current.image, x: event.clientX, y: event.clientY, over: current.over })
    }

    const onUp = (event: PointerEvent) => {
        const current = gesture.current
        if (current?.active) {
            const target = cellAtPoint(event.clientX, event.clientY).cell
            const { currentMap, setCurrentMap, setSelectedTool } = latest.current
            if (target) {
                setCurrentMap(applyTool(currentMap, current.piece, target))
                setSelectedTool(current.piece)
            }
        }
        finish()
    }

    const onCancel = () => finish()

    const listen = () => {
        stopListening()
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onCancel)
        listeners.current = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onCancel)
        }
    }

    const startToolDrag = (event: React.PointerEvent, tool: string, image: string) => {
        if (!isPrimaryButton(event)) return
        gesture.current = { kind: 'tool', piece: tool, image, startX: event.clientX, startY: event.clientY, active: false, over: null }
        listen()
    }

    return <SceneDragContext.Provider value={{ drag, startToolDrag }}>
        {children}
        {drag && <DragGhost drag={drag} />}
    </SceneDragContext.Provider>
}

const GHOST_SIZE_PX = 56

const DragGhost = ({ drag }: { drag: DragView }) =>
    <Portal>
        <img
            data-testid="drag-ghost"
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
                opacity: 0.85,
                zIndex: 2000,
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))'
            }} />
    </Portal>
