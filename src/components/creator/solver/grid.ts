import { ACTOR, EMPTY, OBSTACLE } from "../Editor/SceneEdition/mapUtils"
import { Cell, DIRECTIONS, Direction, Grid, MoveOption } from "./types"

/** '_' cells do not exist in the engine's board (only official maps use them). */
const MISSING = '_'

export const parseMap = (map: string[][]): Grid => {
    const rows = map.length
    const columns = Math.max(0, ...map.map(row => row.length))
    const exists: boolean[][] = []
    const obstacle: boolean[][] = []
    const starts: Cell[] = []
    const objects: Grid['objects'] = []

    for (let row = 0; row < rows; row++) {
        exists.push([])
        obstacle.push([])
        for (let column = 0; column < columns; column++) {
            const content = map[row][column] ?? MISSING
            exists[row].push(content !== MISSING)
            obstacle[row].push(content === OBSTACLE)
            if (content === MISSING || content === OBSTACLE) continue
            content.split('&').forEach(letter => {
                if (letter === ACTOR) starts.push({ row, column })
                else if (letter !== EMPTY) objects.push({ cell: { row, column }, letter })
            })
        }
    }

    if (starts.length !== 1) throw new Error('The map must have exactly one actor')

    return { rows, columns, exists, obstacle, start: starts[0], objects }
}

export const insideGrid = (grid: Grid, { row, column }: Cell) =>
    row >= 0 && row < grid.rows && column >= 0 && column < grid.columns

export const cellExists = (grid: Grid, cell: Cell) => insideGrid(grid, cell) && grid.exists[cell.row][cell.column]

export const sameCell = (a: Cell, b: Cell) => a.row === b.row && a.column === b.column

const MOVE_BLOCKS: Record<Direction, { block: string, value: string }> = {
    right: { block: 'MoverACasillaDerecha', value: 'ParaLaDerecha' },
    down: { block: 'MoverACasillaAbajo', value: 'ParaAbajo' },
    left: { block: 'MoverACasillaIzquierda', value: 'ParaLaIzquierda' },
    up: { block: 'MoverACasillaArriba', value: 'ParaArriba' }
}

/** The "Move to (direction)" block, with its value, is written as a single token. */
export const MOVE_TO_PREFIX = 'MoverA:'

/** Token → direction, for every movement the solver understands. */
export const MOVES: Record<string, Direction> = Object.fromEntries(DIRECTIONS.flatMap(direction => [
    [MOVE_BLOCKS[direction].block, direction],
    [MOVE_TO_PREFIX + MOVE_BLOCKS[direction].value, direction]
]))

/** One token per direction the toolbox allows, in DIRECTIONS order. The single block is preferred. */
export const moveOptions = (toolbox: string[]): MoveOption[] =>
    DIRECTIONS.flatMap(direction => {
        const { block, value } = MOVE_BLOCKS[direction]
        if (toolbox.includes(block)) return [{ direction, token: block }]
        if (toolbox.includes('MoverA') && toolbox.includes(value)) return [{ direction, token: MOVE_TO_PREFIX + value }]
        return []
    })
