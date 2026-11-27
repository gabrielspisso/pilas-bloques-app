import { cellExists } from "./grid"
import { Cell, DELTA, DIRECTIONS, Grid, MoveOption } from "./types"

export const STEP_COST = 100
/** Only breaks ties: among routes of equal length, the one with fewer turns compresses better. */
export const TURN_COST = 1
export const EXACT_ORDER_LIMIT = 16
export const IMPROVE_BUDGET_MS = 500

export type Leg = { cost: number, path: string[] }

/** Index meaning "no previous move". */
const NO_MOVE = DIRECTIONS.length
const STATES_PER_CELL = DIRECTIONS.length + 1

/** Dijkstra over (cell, last direction) from one cell; returns the cheapest leg to any other cell. */
export const shortestLegs = (grid: Grid, from: Cell, moves: MoveOption[]): ((to: Cell) => Leg | null) => {
    const stateOf = (cell: Cell, last: number) => (cell.row * grid.columns + cell.column) * STATES_PER_CELL + last
    const size = grid.rows * grid.columns * STATES_PER_CELL
    const cost: number[] = new Array(size).fill(Infinity)
    const parent: ({ state: number, token: string } | undefined)[] = new Array(size)
    const visited: boolean[] = new Array(size).fill(false)
    const origin = stateOf(from, NO_MOVE)
    cost[origin] = 0

    // Boards are tiny (a few hundred states): a linear search for the minimum is enough.
    for (; ;) {
        let current = -1
        for (let state = 0; state < size; state++)
            if (!visited[state] && cost[state] < Infinity && (current < 0 || cost[state] < cost[current])) current = state
        if (current < 0) break
        visited[current] = true

        const index = Math.floor(current / STATES_PER_CELL)
        const row = Math.floor(index / grid.columns)
        const column = index % grid.columns
        const last = current % STATES_PER_CELL

        for (const { direction, token } of moves) {
            const next = { row: row + DELTA[direction].row, column: column + DELTA[direction].column }
            if (!cellExists(grid, next) || grid.obstacle[next.row][next.column]) continue
            const directionIndex = DIRECTIONS.indexOf(direction)
            const nextState = stateOf(next, directionIndex)
            const nextCost = cost[current] + STEP_COST + (last !== NO_MOVE && last !== directionIndex ? TURN_COST : 0)
            if (nextCost < cost[nextState]) {
                cost[nextState] = nextCost
                parent[nextState] = { state: current, token }
            }
        }
    }

    return (to: Cell) => {
        if (to.row === from.row && to.column === from.column) return { cost: 0, path: [] }
        let best = -1
        for (let last = 0; last < STATES_PER_CELL; last++) {
            const state = stateOf(to, last)
            if (cost[state] < Infinity && (best < 0 || cost[state] < cost[best])) best = state
        }
        if (best < 0) return null
        const path: string[] = []
        for (let state = best; parent[state]; state = parent[state]!.state) path.push(parent[state]!.token)
        return { cost: cost[best], path: path.reverse() }
    }
}

/** Costs between tasks; Infinity when there is no way. */
export type LegCosts = { fromStart: number[], between: number[][] }

export const orderCost = (order: number[], costs: LegCosts) =>
    order.reduce((total, task, i) => total + (i ? costs.between[order[i - 1]][task] : costs.fromStart[task]), 0)

const respects = (order: number[], after: number[][]) => {
    const done = new Set<number>()
    return order.every(task => {
        const ready = after[task].every(required => done.has(required))
        done.add(task)
        return ready
    })
}

/** Held-Karp: best[set of done tasks][last task]. Exact, exponential in the number of tasks. */
const exactOrder = (costs: LegCosts, after: number[][]): number[] | null => {
    const count = after.length
    const INF = 2 ** 30
    const sets = 1 << count
    const best = new Int32Array(sets * count).fill(INF)
    const previous = new Int32Array(sets * count).fill(-1)
    const required = after.map(list => list.reduce((mask, task) => mask | (1 << task), 0))

    for (let task = 0; task < count; task++)
        if (!required[task] && costs.fromStart[task] < INF) best[(1 << task) * count + task] = costs.fromStart[task]

    for (let mask = 1; mask < sets; mask++) {
        for (let last = 0; last < count; last++) {
            const current = best[mask * count + last]
            if (current >= INF) continue
            for (let next = 0; next < count; next++) {
                if (mask & (1 << next) || (required[next] & mask) !== required[next]) continue
                const total = current + costs.between[last][next]
                const target = (mask | (1 << next)) * count + next
                if (total < best[target]) {
                    best[target] = total
                    previous[target] = last
                }
            }
        }
    }

    let mask = sets - 1
    let last = -1
    for (let task = 0; task < count; task++)
        if (best[mask * count + task] < INF && (last < 0 || best[mask * count + task] < best[mask * count + last])) last = task
    if (last < 0) return null

    const order: number[] = []
    while (last >= 0) {
        order.push(last)
        const before: number = previous[mask * count + last]
        mask &= ~(1 << last)
        last = before
    }
    return order.reverse()
}

/** Nearest available task first. */
export const greedyOrder = (costs: LegCosts, after: number[][]): number[] | null => {
    const order: number[] = []
    const done = new Set<number>()
    while (order.length < after.length) {
        const from = order.length ? costs.between[order[order.length - 1]] : costs.fromStart
        let best = -1
        for (let task = 0; task < after.length; task++) {
            if (done.has(task) || !after[task].every(required => done.has(required)) || from[task] === Infinity) continue
            if (best < 0 || from[task] < from[best]) best = task
        }
        if (best < 0) return null
        order.push(best)
        done.add(best)
    }
    return order
}

/** Moves segments of 1 to 3 tasks to a better position while it helps and there is time. */
export const improveOrder = (order: number[], costs: LegCosts, after: number[][], budget = IMPROVE_BUDGET_MS): number[] => {
    const deadline = Date.now() + budget
    let best = order
    let bestCost = orderCost(order, costs)
    let improved = true
    while (improved) {
        improved = false
        for (let length = 1; length <= 3; length++) {
            for (let from = 0; from + length <= best.length; from++) {
                for (let to = 0; to + length <= best.length; to++) {
                    if (Date.now() > deadline) return best
                    if (to === from) continue
                    const rest = best.slice(0, from).concat(best.slice(from + length))
                    const candidate = rest.slice(0, to).concat(best.slice(from, from + length), rest.slice(to))
                    const cost = orderCost(candidate, costs)
                    if (cost < bestCost && respects(candidate, after)) {
                        best = candidate
                        bestCost = cost
                        improved = true
                    }
                }
            }
        }
    }
    return best
}

/** The order in which to visit the tasks. null when no order satisfies the constraints. */
export const visitOrder = (costs: LegCosts, after: number[][]): { order: number[], exact: boolean } | null => {
    if (!after.length) return { order: [], exact: true }
    if (after.length <= EXACT_ORDER_LIMIT) {
        const order = exactOrder(costs, after)
        return order && { order, exact: true }
    }
    const greedy = greedyOrder(costs, after)
    return greedy && { order: improveOrder(greedy, costs, after), exact: false }
}
