import { findActions, taskLegs } from "../../../../../components/creator/solver/findSolution"
import { moveOptions, parseMap } from "../../../../../components/creator/solver/grid"
import { greedyOrder, improveOrder, orderCost } from "../../../../../components/creator/solver/pathfinding"
import { modelFor, simulateWith } from "../../../../../components/creator/solver/sceneModel"
import { TaskPlan } from "../../../../../components/creator/solver/types"
import { D, MOVES4, R, cell } from "./helpers"

const duba = modelFor('Duba')!
const toolbox = [...MOVES4, 'ComerChurrasco']

const solve = (map: string[][], blocks = toolbox) => {
    const grid = parseMap(map)
    const plan = duba.planTasks(grid, blocks) as TaskPlan
    return findActions(grid, plan, blocks)
}

/** 10 rows x 8 columns, actor at (0,0), steaks on the first `amount` cells that match. */
const bigMap = (amount: number, matches: (index: number) => boolean) => {
    let placed = 0
    return Array.from({ length: 10 }, (_, r) => Array.from({ length: 8 }, (_, c) => {
        if (r === 0 && c === 0) return 'A'
        if (placed < amount && matches(r * 8 + c)) { placed++; return 'P' }
        return '-'
    }))
}

describe("findActions", () => {
    test("walks to the object and acts", () => {
        expect(solve([["A", "-", "P"]])).toEqual({ actions: [R, R, 'ComerChurrasco'], exactOrder: true })
    })

    test("objects that cannot be reached", () => {
        expect(solve([["A", "O", "P"]])).toEqual({ kind: 'unreachable', cells: [cell(0, 2)] })
        expect(solve([["P", "A"]], [R, D, 'ComerChurrasco'])).toEqual({ kind: 'unreachable', cells: [cell(0, 0)] })
    })

    test("among routes of equal length it takes the one with fewer turns", () => {
        const found = solve([["A", "-", "-"], ["-", "-", "-"], ["-", "-", "P"]]) as { actions: string[] }
        const moves = found.actions.slice(0, -1)
        expect(moves).toHaveLength(4)
        expect(moves.filter((token, i) => i && token !== moves[i - 1])).toHaveLength(1)
    })

    test("respects the order constraints, and reports impossible ones", () => {
        const grid = parseMap([["A", "-", "-"]])
        const plan = (first: number[], second: number[]): TaskPlan => ({
            tasks: [{ cell: cell(0, 2), action: 'X', after: first }, { cell: cell(0, 1), action: 'Y', after: second }],
            notes: []
        })
        expect(findActions(grid, plan([1], []), MOVES4)).toEqual({ actions: [R, 'Y', R, 'X'], exactOrder: true })
        expect(findActions(grid, plan([1], [0]), MOVES4)).toEqual({ kind: 'noRoute' })
    })

    test.each([
        [16, (index: number) => index % 5 === 3, true],
        [30, (index: number) => index % 2 === 1, false]
    ])("%i objects are solved fast", (amount, matches, exact) => {
        const map = bigMap(amount, matches)
        expect(map.flat().filter(c => c === 'P')).toHaveLength(amount)
        const start = Date.now()
        const found = solve(map) as { actions: string[], exactOrder: boolean }
        const elapsed = Date.now() - start
        console.log(`phase 1 with ${amount} objects: ${elapsed} ms, ${found.actions.length} tokens`)
        expect(found.exactOrder).toBe(exact)
        expect(simulateWith(duba, map, found.actions)).toEqual({ solved: true })
        expect(elapsed).toBeLessThan(1500)
    })

    test("relocating segments never makes the greedy order worse", () => {
        const grid = parseMap(bigMap(30, index => index % 2 === 1))
        const plan = duba.planTasks(grid, toolbox) as TaskPlan
        const { costs } = taskLegs(grid, plan.tasks, moveOptions(toolbox))
        const after = plan.tasks.map(task => task.after)
        const greedy = greedyOrder(costs, after)!
        const improved = improveOrder(greedy, costs, after)
        expect([...improved].sort((a, b) => a - b)).toEqual(after.map((_, i) => i))
        expect(orderCost(improved, costs)).toBeLessThanOrEqual(orderCost(greedy, costs))
        console.log(`greedy ${orderCost(greedy, costs)} -> improved ${orderCost(improved, costs)}`)
    })
})
