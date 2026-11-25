import { moveOptions, sameCell } from "./grid"
import { Leg, LegCosts, shortestLegs, visitOrder } from "./pathfinding"
import { Cell, Grid, MoveOption, SolverFailure, Task, TaskPlan } from "./types"

/** Cheapest legs from the start and between every pair of tasks. */
export const taskLegs = (grid: Grid, tasks: Task[], moves: MoveOption[]) => {
    const searches = new Map<string, (to: Cell) => Leg | null>()
    const searchFrom = (cell: Cell) => {
        const key = `${cell.row},${cell.column}`
        if (!searches.has(key)) searches.set(key, shortestLegs(grid, cell, moves))
        return searches.get(key)!
    }
    const fromStart = tasks.map(task => searchFrom(grid.start)(task.cell))
    const between = tasks.map(origin => tasks.map(task => searchFrom(origin.cell)(task.cell)))
    const costOf = (leg: Leg | null) => leg ? leg.cost : Infinity
    const costs: LegCosts = { fromStart: fromStart.map(costOf), between: between.map(row => row.map(costOf)) }
    return { fromStart, between, costs }
}

/** Phase 1: a shortest list of tokens that walks to every task, in an allowed order, and runs it. */
export const findActions = (grid: Grid, plan: TaskPlan, toolbox: string[]): { actions: string[], exactOrder: boolean } | SolverFailure => {
    const { tasks } = plan
    const legs = taskLegs(grid, tasks, moveOptions(toolbox))

    const unreachable = tasks
        .filter((_, i) => !legs.fromStart[i])
        .map(task => task.cell)
        .filter((cell, i, all) => all.findIndex(other => sameCell(other, cell)) === i)
    if (unreachable.length) return { kind: 'unreachable', cells: unreachable }

    const visit = visitOrder(legs.costs, tasks.map(task => task.after))
    if (!visit) return { kind: 'noRoute' }

    const actions = visit.order.flatMap((task, i) => {
        const leg = i ? legs.between[visit.order[i - 1]][task] : legs.fromStart[task]
        return [...leg!.path, tasks[task].action]
    })
    return { actions, exactOrder: visit.exact }
}
