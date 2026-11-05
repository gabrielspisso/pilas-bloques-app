import { SceneMap } from "../../../serializedChallenge"
import { Position } from "./Grid/SceneCell"

export const OBSTACLE = "O"
export const ACTOR = "A"
export const EMPTY = "-"

//Remeber to change de default scene at serializedChallenge.tsx if the inital position for Actor changes
export const INITIAL_COL = 0
export const INITIAL_ROW = 0

export const PROCEDURE_CATEGORY = 'myprocedures'

/**
 * If no position is given, the actor is set in the initial one (0,0)
 * @returns a map with the actor in another position.
 */
export const setActorAtPosition = (inMap: SceneMap, row = INITIAL_ROW, col = INITIAL_COL): SceneMap => {
    if (inMap[row][col] === EMPTY || inMap[row][col] === OBSTACLE) {
        inMap[row][col] = ""
    }
    inMap[row][col] = ACTOR + (inMap[row][col].length ? '&' + inMap[row][col] : '')
    return inMap
}

export const hasActor = (cell: string): boolean => cell.split('&').includes(ACTOR)

const actorIsInMap = (map: SceneMap): boolean => map.some(rowHasActor)

const rowHasActor = (row: string[]): boolean => row.some(hasActor)

export const relocateActorIfRemoved = (map: SceneMap) => {
    if(!actorIsInMap(map)) setActorAtPosition(map)
}

export const actorPosition = (map: SceneMap): Position | null => {
    if(!actorIsInMap(map)) return null
    let row = map.findIndex(rowHasActor)
    let column = map[row].findIndex(hasActor)
    return { row, column }
}

const cloneMap = (map: SceneMap): SceneMap => map.map(row => row.slice())

export const objectsInCell = (cell: string): string[] => cell.split('&').filter(o => o !== EMPTY)

const isInitialPosition = (position: Position): boolean => position.row === INITIAL_ROW && position.column === INITIAL_COL

export const samePosition = (a: Position | null | undefined, b: Position | null | undefined): boolean =>
    !!a && !!b && a.row === b.row && a.column === b.column

const removeActorFromMap = (map: SceneMap): SceneMap => {
    const prevPos = actorPosition(map)
    if (!prevPos) return map
    const cellObjects = map[prevPos.row][prevPos.column].split('&')
    map[prevPos.row][prevPos.column] = cellObjects.length > 1 ? cellObjects[1] : EMPTY
    return map
}

/**
 * Applies a palette tool (actor, obstacle, eraser or object) to a cell.
 * Pure: returns a new map and never leaves the map without an actor or with two.
 */
export const applyTool = (inMap: SceneMap, tool: string, position: Position): SceneMap => {
    const map = cloneMap(inMap)
    const { row, column } = position
    const content = map[row][column]
    const actorHere = hasActor(content)
    const multipleObjects = objectsInCell(content).length > 1

    switch (tool) {
        case OBSTACLE:
            if (actorHere && isInitialPosition(position)) return map // the actor can't be replaced at the initial cell
            if (actorHere) setActorAtPosition(map)
            map[row][column] = OBSTACLE
            return map
        case EMPTY:
            if (actorHere && isInitialPosition(position) && !multipleObjects) return map // the actor can't be erased at the initial cell
            if (actorHere && !multipleObjects) setActorAtPosition(map)
            map[row][column] = multipleObjects ? ACTOR : EMPTY
            return map
        case ACTOR:
            return setActorAtPosition(removeActorFromMap(map), row, column)
        default:
            map[row][column] = actorHere ? ACTOR + '&' + tool : tool
            return map
    }
}

/**
 * Removes one piece from a cell. The actor is never removed: it goes back to the initial cell
 * (and stays there if it already was there).
 */
export const removePiece = (inMap: SceneMap, position: Position, piece: string): SceneMap => {
    const map = cloneMap(inMap)
    const objects = objectsInCell(map[position.row][position.column])
    if (!objects.includes(piece)) return map
    if (piece === ACTOR && isInitialPosition(position)) return map
    map[position.row][position.column] = objects.filter(o => o !== piece).join('&') || EMPTY
    if (piece === ACTOR) setActorAtPosition(map)
    return map
}

/**
 * Moves a placed piece to another cell, with the same rules as the palette tools.
 * A null destination (dropped outside the board) removes the piece.
 * If the destination doesn't accept the piece, nothing changes.
 */
export const movePiece = (inMap: SceneMap, from: Position, piece: string, to: Position | null): SceneMap => {
    if (!objectsInCell(inMap[from.row][from.column]).includes(piece)) return cloneMap(inMap)
    if (!to) return removePiece(inMap, from, piece)
    if (samePosition(from, to)) return cloneMap(inMap)
    if (piece === ACTOR) return applyTool(inMap, ACTOR, to)
    const moved = applyTool(removePiece(inMap, from, piece), piece, to)
    return objectsInCell(moved[to.row][to.column]).includes(piece) ? moved : cloneMap(inMap)
}

/** Grid size limits of the creator (rows x columns). */
export const GRID_LIMITS = { minRows: 1, maxRows: 10, minColumns: 1, maxColumns: 8 }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/**
 * Pure resize: returns a new rows x columns map (clamped to GRID_LIMITS). Cells in the area common
 * to both sizes are kept, cells outside are discarded, new cells are empty. If the actor was cut out
 * it goes back to the initial cell (relocateActorIfRemoved), so there is always exactly one.
 */
export const resizeMap = (inMap: SceneMap, rows: number, columns: number): SceneMap => {
    const newRows = clamp(Math.round(rows), GRID_LIMITS.minRows, GRID_LIMITS.maxRows)
    const newColumns = clamp(Math.round(columns), GRID_LIMITS.minColumns, GRID_LIMITS.maxColumns)
    const map: SceneMap = Array.from({ length: newRows }, (_, i) =>
        Array.from({ length: newColumns }, (_, j) => inMap[i]?.[j] ?? EMPTY))
    relocateActorIfRemoved(map)
    return map
}

export type CellDragMode = { mode: 'paint' } | { mode: 'move', piece: string }

/**
 * Dragging from a cell paints with the selected tool when the cell is empty, when the eraser is
 * selected or when the cell already has the selected piece. Otherwise it moves the piece in the cell
 * (the actor first, since it is drawn on top).
 */
export const cellDragMode = (content: string, selectedTool: string): CellDragMode => {
    const objects = objectsInCell(content)
    if (!objects.length || selectedTool === EMPTY || (selectedTool !== ACTOR && objects.includes(selectedTool))) return { mode: 'paint' }
    return { mode: 'move', piece: objects.includes(ACTOR) ? ACTOR : objects[objects.length - 1] }
}
