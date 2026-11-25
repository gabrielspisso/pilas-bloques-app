import { cellExists, parseMap, sameCell } from "./grid"
import { ifToken } from "./optimize"
import { ProgramRun, SceneModel, sensorFor } from "./sceneModel"
import { Grid, SolverFailure, SolverNote, Statement, Task, TaskPlan } from "./types"

/** One board and one list of tasks whose program works on every scenario. */
export type CommonPuzzle =
    | { kind: 'puzzle', grid: Grid, plan: TaskPlan, conditional: boolean }
    | { kind: 'incompatible', reason: Extract<SolverNote, { id: 'scenariosIncompatible' }>['reason'] }
    | { kind: 'needsBlocks', blocks: string[] }

const incompatibility = (grids: Grid[]) => {
    const [first] = grids
    if (grids.some(grid => grid.rows !== first.rows || grid.columns !== first.columns)) return 'size'
    if (grids.some(grid => !sameCell(grid.start, first.start))) return 'start'
    // A cell cannot be blocked in one scenario while it holds the start or an object in another.
    const used = grids.flatMap(grid => [grid.start, ...grid.objects.map(object => object.cell)])
    if (used.some(cell => grids.some(grid => !cellExists(grid, cell) || grid.obstacle[cell.row][cell.column]))) return 'obstacleConflict'
    return null
}

const union = (grids: Grid[]): Grid => ({
    ...grids[0],
    exists: grids[0].exists.map((row, r) => row.map((_, c) => grids.every(grid => grid.exists[r][c]))),
    obstacle: grids[0].obstacle.map((row, r) => row.map((_, c) => grids.some(grid => grid.obstacle[r][c]))),
    objects: grids.flatMap(grid => grid.objects)
})

const unique = <T,>(items: T[]) => Array.from(new Set(items))

/** Joins the failures of every scenario that the toolbox or the engine impose. */
const joinFailures = (failures: SolverFailure[]): SolverFailure => {
    const limitations = failures.flatMap(failure => failure.kind === 'engineLimitation' ? failure.cells : [])
    if (limitations.length) return {
        kind: 'engineLimitation', id: 'pingPong',
        cells: limitations.filter((cell, i) => limitations.findIndex(other => sameCell(other, cell)) === i)
    }
    const missing = unique(failures.flatMap(failure => failure.kind === 'missingBlocks' ? failure.blocks : []))
    return missing.length ? { kind: 'missingBlocks', blocks: missing } : failures[0]
}

/**
 * Every object of any scenario becomes a task. When some scenario lacks that object in that cell,
 * the task is conditional: "If (sensor)" asks before acting. Throws if a map cannot be read.
 */
export const commonPuzzle = (model: SceneModel, maps: string[][][], toolbox: string[]): CommonPuzzle | SolverFailure => {
    const grids = maps.map(parseMap)
    const reason = incompatibility(grids)
    if (reason) return { kind: 'incompatible', reason }
    if (grids.some(grid => grid.objects.some(({ letter }) => !model.letters.includes(letter)))) return { kind: 'invalidMap' }

    // A scenario without objects simply asks for nothing.
    const plans = grids.map(grid => model.planTasks(grid, toolbox))
    const failures = plans.flatMap(plan => 'kind' in plan && plan.kind !== 'nothingToDo' ? [plan] : [])
    if (failures.length) return joinFailures(failures)
    const taskPlans = plans.map(plan => 'kind' in plan ? { tasks: [], notes: [] } as TaskPlan : plan)

    const grid = union(grids)
    const letterOf = (task: Task) => model.actions[task.action].letter
    const isSame = (a: Task, b: Task) => a.action === b.action && sameCell(a.cell, b.cell)

    const distinct = taskPlans.flatMap(plan => plan.tasks)
        .filter((task, i, all) => all.findIndex(other => isSame(other, task)) === i)
        .sort((a, b) => a.cell.row - b.cell.row || a.cell.column - b.cell.column ||
            model.letters.indexOf(letterOf(a)) - model.letters.indexOf(letterOf(b)))
    if (!distinct.length) return { kind: 'nothingToDo' }

    const missing: string[] = []
    let conditional = false
    const tasks = distinct.map(task => {
        const letter = letterOf(task)
        const everywhere = grids.every(other => other.objects.some(object => object.letter === letter && sameCell(object.cell, task.cell)))
        const after = unique(taskPlans.flatMap(plan => plan.tasks
            .filter(own => isSame(own, task))
            .flatMap(own => own.after.map(required => distinct.findIndex(other => isSame(other, plan.tasks[required]))))))
        if (everywhere) return { ...task, after }

        conditional = true
        const sensor = sensorFor(model, letter)!
        missing.push(...['Si', sensor].filter(block => !toolbox.includes(block)))
        return { cell: task.cell, action: ifToken(sensor, task.action), after }
    })
    if (missing.length) return { kind: 'needsBlocks', blocks: unique(missing) }

    const notes = taskPlans.flatMap(plan => plan.notes)
        .filter((note, i, all) => all.findIndex(other => other.id === note.id) === i)
        .map(note => 'cells' in note ? {
            ...note,
            cells: taskPlans.flatMap(plan => plan.notes).flatMap(other => other.id === note.id && 'cells' in other ? other.cells : [])
                .filter((cell, i, all) => all.findIndex(other => sameCell(other, cell)) === i)
        } : note)

    return { kind: 'puzzle', grid, plan: { tasks, notes }, conditional }
}

/** Every "If" has to decide something: its sensor was true in some run and false in another. */
export const everyIfDecides = (runs: ProgramRun[]) => {
    const values = new Map<Statement, { run: number, value: boolean }[]>()
    runs.forEach((run, i) => run.trace.filter(entry => entry.node.kind === 'if').forEach(({ node, value }) =>
        values.set(node, [...(values.get(node) ?? []), { run: i, value }])))
    return Array.from(values.values()).every(seen =>
        seen.some(a => a.value && seen.some(b => !b.value && b.run !== a.run)))
}
