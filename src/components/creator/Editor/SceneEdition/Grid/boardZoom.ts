/**
 * Board zoom and pan, as pure functions. The zoom is visual only: it multiplies the cell size that
 * computeCellSize picked (a real layout size, not a CSS transform, so hit testing, drag and drop,
 * painting and moving keep working) and never touches the challenge or the undo history.
 * Panning is the scroll of the board container.
 */

/** 1 = the size that fits (the cell size from computeCellSize, 44 to 150 px). */
export const MIN_ZOOM = 1
export const MAX_ZOOM = 3
/** Each +/− button press multiplies / divides by this. */
export const ZOOM_STEP = 1.25
/** Ctrl/Cmd + wheel: zoom factor per wheel pixel (exponential, so trackpads feel smooth). */
export const WHEEL_ZOOM_PER_PX = 0.002

/** Clamped to [MIN_ZOOM, MAX_ZOOM], rounded to 0.01 and snapped to 1 when very close. */
export const clampZoom = (zoom: number): number => {
    if (!Number.isFinite(zoom)) return MIN_ZOOM
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
    const rounded = Math.round(clamped * 100) / 100
    return Math.abs(rounded - 1) < 0.02 ? 1 : rounded
}

export const zoomIn = (zoom: number) => clampZoom(zoom * ZOOM_STEP)
export const zoomOut = (zoom: number) => clampZoom(zoom / ZOOM_STEP)

export const canZoomIn = (zoom: number) => zoom < MAX_ZOOM
export const canZoomOut = (zoom: number) => zoom > MIN_ZOOM

/** Wheel delta in pixels (deltaMode 0 = pixels, 1 = lines, 2 = pages). */
export const wheelDeltaPixels = (deltaY: number, deltaMode = 0) =>
    deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY

/** Ctrl/Cmd + wheel (and trackpad pinch, which browsers report like that): up zooms in. */
export const wheelZoom = (zoom: number, deltaY: number, deltaMode = 0) =>
    clampZoom(zoom * Math.exp(-wheelDeltaPixels(deltaY, deltaMode) * WHEEL_ZOOM_PER_PX))

export type Point = { x: number, y: number }

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Two fingers: the zoom changes in proportion to the distance between them. */
export const pinchZoom = (startZoom: number, startDistance: number, currentDistance: number) =>
    startDistance > 0 ? clampZoom(startZoom * currentDistance / startDistance) : clampZoom(startZoom)

/** Zoomed cell size (px); null when the space can't be measured. */
export const zoomedCellSize = (cellSize: number | null, zoom: number): number | null =>
    cellSize === null ? null : Math.round(cellSize * clampZoom(zoom) * 100) / 100

/**
 * Where a viewport point falls on the board, as a fraction [0, 1] of its size on each axis
 * (boardStart: the board's left/top on screen; boardSize: its width/height).
 */
export const boardFraction = (point: number, boardStart: number, boardSize: number) =>
    boardSize > 0 ? Math.max(0, Math.min(1, (point - boardStart) / boardSize)) : 0.5

/**
 * After zooming, how much to scroll (on one axis) so the board point that was under the anchor
 * (pointer, pinch center or the viewport center) stays under it.
 * newBoardStart / newBoardSize: the board on screen after the new layout, before scrolling.
 */
export const anchoredScrollDelta = (fraction: number, newBoardStart: number, newBoardSize: number, anchor: number) =>
    newBoardStart + fraction * newBoardSize - anchor

/** Dragging to pan: the content follows the pointer, so the scroll moves the other way. */
export const panScroll = (startScroll: Point, start: Point, current: Point): Point => ({
    x: startScroll.x - (current.x - start.x),
    y: startScroll.y - (current.y - start.y)
})

/** Percentage shown to the user (e.g. 1.25 → 125). */
export const zoomPercent = (zoom: number) => Math.round(clampZoom(zoom) * 100)
