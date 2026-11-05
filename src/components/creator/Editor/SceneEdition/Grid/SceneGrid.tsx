import { Box, Stack } from "@mui/material"
import { computeCellSize } from "./cellSize"
import { SceneType, SerializedChallenge, defaultChallenge } from "../../../../serializedChallenge"
import { LocalStorage } from "../../../../../localStorage"
import styles from "./grid.module.css"
import { SceneCell } from "./SceneCell"
import { useContext, CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react"
import { anchoredScrollDelta, distance, midpoint, panScroll, pinchZoom, Point, wheelZoom, zoomedCellSize } from "./boardZoom"
import { BoardZoom, useBoardZoom } from "./useBoardZoom"
import { CreatorContext } from "../../CreatorContext"
import { CELL_COLUMN_ATTRIBUTE, CELL_ROW_ATTRIBUTE, SCENE_GRID_ATTRIBUTE, useSceneDrag } from "../SceneDrag"
import { Position } from "./SceneCell"
import { applyTool, EMPTY, MOVE_TOOL, samePosition } from "../mapUtils"
import { pieceName } from "../boardLabels"
import { useTranslation } from "react-i18next"
import { useThemeContext } from "../../../../../theme/ThemeContext"

type AvailableSpace = { width: number, height: number }

/**
 * Measures the content box of the board container (ResizeObserver): it changes when the window is
 * resized and when the panel remounts (switching between "Editor" and "Editor con prueba").
 * Returns null when it can't be measured (e.g. no ResizeObserver in jsdom): the grid then fills the width (100%).
 */
const useAvailableSpace = (ref: React.RefObject<HTMLElement>): AvailableSpace | null => {
    const [space, setSpace] = useState<AvailableSpace | null>(null)

    useEffect(() => {
        const element = ref.current
        if (!element || typeof ResizeObserver === 'undefined') return

        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect
            setSpace(prev => prev && prev.width === width && prev.height === height ? prev : { width, height })
        })
        observer.observe(element)
        return () => observer.disconnect()
    }, [ref])

    return space
}

/**
 * Square cells as big as the measured space allows (computeCellSize), as an explicit pixel width:
 * cells are flex: 1 with aspect-ratio 1, so each one is width / columns on both sides.
 * The visual zoom multiplies that size (a real layout size: hit testing keeps working); the
 * container scrolls (pans) when the zoomed board doesn't fit.
 */
export const fluidGridStyle = (space: AvailableSpace | null, rows: number, columns: number, zoom = 1): CSSProperties => {
    const cellSize = zoomedCellSize(space ? computeCellSize(space.width, space.height, rows, columns) : null, zoom)
    return cellSize === null ? { width: `${Math.round(100 * zoom)}%` } : { width: `${cellSize * columns}px` }
}

const touchPoint = (touch: Touch): Point => ({ x: touch.clientX, y: touch.clientY })

const KEY_MOVES: Record<string, Position> = {
    ArrowUp: { row: -1, column: 0 },
    ArrowDown: { row: 1, column: 0 },
    ArrowLeft: { row: 0, column: -1 },
    ArrowRight: { row: 0, column: 1 }
}

export const SceneGrid = (props: { boardZoom?: BoardZoom }) => {
    const { currentMap, setCurrentMap, selectedTool, index } = useContext(CreatorContext)
    const { t } = useTranslation('creator', { useSuspense: false }) // the board must render even before translations load
    const { theme } = useThemeContext()
    const { moveSelection, moveTap, cancelMove, cancelGesture } = useSceneDrag()
    const moveMode = selectedTool === MOVE_TOOL
    const ownZoom = useBoardZoom()
    const boardZoom = props.boardZoom ?? ownZoom

    const storageChallenge = LocalStorage.getCreatorChallenge()
    const challenge: SerializedChallenge = storageChallenge ? storageChallenge : defaultChallenge('Duba')

    const sceneType: SceneType = challenge.scene.type

    const containerRef = boardZoom.viewportRef
    const space = useAvailableSpace(containerRef)
    const gridStyle = fluidGridStyle(space, currentMap.length, currentMap[0]?.length || 1, boardZoom.zoom)

    // Keyboard: one Tab stop (roving tabindex), arrows move, Enter/Space place the selected tool, Delete erases.
    const rows = currentMap.length
    const columns = currentMap[0]?.length || 1
    const [focused, setFocused] = useState<Position>({ row: 0, column: 0 })
    const active = { row: Math.min(focused.row, rows - 1), column: Math.min(focused.column, columns - 1) }
    const gridRef = boardZoom.gridRef
    const refocus = useRef(false)

    useBoardGestures(boardZoom, cancelGesture)

    useEffect(() => {
        // Cells remount when their content changes, so focus is restored after keyboard edits/moves.
        if (!refocus.current) return
        refocus.current = false
        gridRef.current?.querySelector<HTMLElement>(`[${CELL_ROW_ATTRIBUTE}="${active.row}"][${CELL_COLUMN_ATTRIBUTE}="${active.column}"]`)?.focus()
    })

    // Previous render's map, to know which cells just changed (for the placement animation).
    const previous = useRef<{ index: number, map: string[][] } | null>(null)
    const before = previous.current
    const comparable = before && before.index === index && before.map.length === rows && (before.map[0]?.length || 1) === columns
    const previousContentAt = (i: number, j: number, content: string) =>
        comparable && before!.map[i][j] !== content ? before!.map[i][j] : undefined
    useEffect(() => { previous.current = { index, map: currentMap.map(row => row.slice()) } })

    const handleKeyDown = (event: React.KeyboardEvent) => {
        const move = KEY_MOVES[event.key]
        if (move) {
            event.preventDefault()
            setFocused({
                row: Math.max(0, Math.min(rows - 1, active.row + move.row)),
                column: Math.max(0, Math.min(columns - 1, active.column + move.column))
            })
            refocus.current = true
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            // Move tool: Enter picks the piece, arrows choose the destination, Enter drops it there.
            if (moveMode) moveTap(active)
            else setCurrentMap(applyTool(currentMap, selectedTool, active))
            refocus.current = true
        } else if (event.key === 'Escape' && moveSelection) {
            event.preventDefault()
            cancelMove()
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault()
            setCurrentMap(applyTool(currentMap, EMPTY, active))
            refocus.current = true
        }
    }

    const handleFocus = (event: React.FocusEvent) => {
        const cell = (event.target as HTMLElement).closest?.(`[${CELL_ROW_ATTRIBUTE}]`)
        if (!cell) return
        const position = { row: Number(cell.getAttribute(CELL_ROW_ATTRIBUTE)), column: Number(cell.getAttribute(CELL_COLUMN_ATTRIBUTE)) }
        if (!samePosition(position, active)) setFocused(position)
    }

    // The viewport scrolls inside when even the minimum cell size does not fit, or when zoomed (never the page).
    return <Box ref={containerRef} className={styles['board-viewport']} data-testid="board-viewport" data-zoom={boardZoom.zoom}
        onPointerDown={event => startPan(event, containerRef.current)}>
        <Stack justifyContent='flex-start' className={styles.grid} data-testid="dummy-test-scene-grid" {...{ [SCENE_GRID_ATTRIBUTE]: true }}
            ref={gridRef}
            role="grid"
            aria-label={t('editor.board.label', { scenario: index + 1, rows, columns })!}
            aria-describedby="scene-grid-instructions"
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            style={{ ...gridStyle, ['--creator-focus-color' as any]: theme.palette.primary.main }}>
            <span id="scene-grid-instructions" className={styles['visually-hidden']}>{t(moveMode ? 'editor.board.moveInstructions' : 'editor.board.instructions')}</span>
            <span role="status" aria-live="polite" className={styles['visually-hidden']} data-testid="move-status">
                {moveSelection ? t('editor.board.picked', { piece: pieceName(t, sceneType, moveSelection.piece) }) : ''}
            </span>
            {currentMap.map((row, i) =>
                <Stack key={i + row.join(',')} direction="row" data-testid="challenge-row" role="row">
                    {row.map((cellContent, j) =>
                        <SceneCell
                            position={{ row: i, column: j }}
                            key={i * 100 + j + cellContent}
                            content={cellContent}
                            tabIndex={i === active.row && j === active.column ? 0 : -1}
                            previousContent={previousContentAt(i, j, cellContent)}
                            sceneType={sceneType} />)}
                </Stack>)}
        </Stack>
    </Box>
}

/**
 * Zoom gestures on the board viewport (native listeners, non passive so they can prevent the page zoom):
 * - Ctrl/Cmd + wheel (also trackpad pinch) zooms around the pointer; a plain wheel scrolls as usual.
 * - Two fingers: pinch zooms around their center and moving them pans. The second finger cancels the
 *   press of the first one, so no piece is painted or moved by accident.
 * One finger keeps the native scroll (a piece drag starts only after holding still, see TOUCH_HOLD_MS).
 * After a zoom change, the board point that was under the anchor is scrolled back under it.
 */
const useBoardGestures = (boardZoom: BoardZoom, cancelGesture: () => void) => {
    const latest = useRef({ boardZoom, cancelGesture })
    latest.current = { boardZoom, cancelGesture }
    const { zoom, viewportRef, gridRef, pendingAnchor } = boardZoom

    useLayoutEffect(() => {
        const anchor = pendingAnchor.current
        pendingAnchor.current = null
        const viewport = viewportRef.current
        const grid = gridRef.current
        if (!anchor || !viewport || !grid) return
        const rect = grid.getBoundingClientRect()
        viewport.scrollLeft += anchoredScrollDelta(anchor.fx, rect.left, rect.width, anchor.x)
        viewport.scrollTop += anchoredScrollDelta(anchor.fy, rect.top, rect.height, anchor.y)
    }, [zoom, viewportRef, gridRef, pendingAnchor])

    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return
        let pinch: { startDistance: number, startZoom: number, lastCenter: Point } | null = null

        const onWheel = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return
            event.preventDefault()
            const { zoom, zoomTo } = latest.current.boardZoom
            zoomTo(wheelZoom(zoom, event.deltaY, event.deltaMode), { x: event.clientX, y: event.clientY })
        }
        const onTouchStart = (event: TouchEvent) => {
            if (event.touches.length < 2) return
            event.preventDefault()
            latest.current.cancelGesture()
            const a = touchPoint(event.touches[0])
            const b = touchPoint(event.touches[1])
            pinch = { startDistance: distance(a, b), startZoom: latest.current.boardZoom.zoom, lastCenter: midpoint(a, b) }
        }
        const onTouchMove = (event: TouchEvent) => {
            if (!pinch || event.touches.length < 2) return
            event.preventDefault()
            const a = touchPoint(event.touches[0])
            const b = touchPoint(event.touches[1])
            const center = midpoint(a, b)
            const panned = panScroll({ x: viewport.scrollLeft, y: viewport.scrollTop }, pinch.lastCenter, center)
            viewport.scrollLeft = panned.x
            viewport.scrollTop = panned.y
            pinch.lastCenter = center
            latest.current.boardZoom.zoomTo(pinchZoom(pinch.startZoom, pinch.startDistance, distance(a, b)), center)
        }
        const onTouchEnd = (event: TouchEvent) => { if (event.touches.length < 2) pinch = null }

        viewport.addEventListener('wheel', onWheel, { passive: false })
        viewport.addEventListener('touchstart', onTouchStart, { passive: false })
        viewport.addEventListener('touchmove', onTouchMove, { passive: false })
        viewport.addEventListener('touchend', onTouchEnd)
        viewport.addEventListener('touchcancel', onTouchEnd)
        return () => {
            viewport.removeEventListener('wheel', onWheel)
            viewport.removeEventListener('touchstart', onTouchStart)
            viewport.removeEventListener('touchmove', onTouchMove)
            viewport.removeEventListener('touchend', onTouchEnd)
            viewport.removeEventListener('touchcancel', onTouchEnd)
        }
    }, [viewportRef])
}

/**
 * Mouse panning: dragging with the middle button anywhere on the board, or with the main button on
 * the empty area around the cells (pressing a cell keeps painting / moving pieces as before).
 */
const startPan = (event: React.PointerEvent, viewport: HTMLElement | null) => {
    if (!viewport || event.pointerType === 'touch') return
    const onCell = !!(event.target as HTMLElement).closest?.(`[${CELL_ROW_ATTRIBUTE}]`)
    const middle = event.button === 1
    if (!middle && !(event.button === 0 && !onCell)) return
    event.preventDefault()
    const start = { x: event.clientX, y: event.clientY }
    const startScroll = { x: viewport.scrollLeft, y: viewport.scrollTop }
    const onMove = (move: PointerEvent) => {
        const next = panScroll(startScroll, start, { x: move.clientX, y: move.clientY })
        viewport.scrollLeft = next.x
        viewport.scrollTop = next.y
    }
    const stop = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', stop)
        window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
}
