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
