import { SceneType } from "../../serializedChallenge"
import { ACTOR, EMPTY, OBSTACLE } from "../Editor/SceneEdition/mapUtils"
import { MOVES, cellExists, parseMap, sameCell } from "./grid"
import { dubaModel } from "./scenes/duba"
import { Cell, DELTA, Grid, SimulationFailure, SimulationResult, SolverFailure, Task, TaskPlan } from "./types"

export type ObjectState = { cell: Cell, letter: string, status: 'present' | 'done' | 'removed' }
export type SimState = { position: Cell, objects: ObjectState[], flags: Record<string, boolean> }

/** How one action block behaves, taken from the engine (pilas-bloques-exercises). */
export type ActionRule = {
    /** object it needs in the current cell */
    letter: string
    /** remove: the engine's "Recolectar"; markOnce: status 'done', fails if already done */
    effect: 'remove' | 'markOnce'
    extraCheck?: (state: SimState) => SimulationFailure | null
    onDone?: (state: SimState) => void
    /** the block throws in this scene */
    engineError?: true
}

export type SceneModel = {
    type: SceneType
    /** object letters this model understands (others -> unknownCell) */
    letters: string[]
    /** action block id -> rule */
    actions: Record<string, ActionRule>
    /** engine victory */
    won: (state: SimState) => boolean
    /** Mission tasks for a map, or a failure. Movement is not decided here. */
    planTasks: (grid: Grid, toolbox: string[]) => TaskPlan | SolverFailure
}

/** No object with that letter is left on the board. */
export const none = (state: SimState, letter: string) =>
    state.objects.every(object => object.letter !== letter || object.status === 'removed')

/** Every object with that letter was already acted on (or is gone). */
export const allDoneOrGone = (state: SimState, letter: string) =>
    state.objects.every(object => object.letter !== letter || object.status !== 'present')

export const initialState = (grid: Grid): SimState => ({
    position: { ...grid.start },
    objects: grid.objects.map(({ cell, letter }) => ({ cell, letter, status: 'present' })),
    flags: {}
})

/** Collects tasks and the mandatory blocks the toolbox lacks (without repetitions, in order of appearance). */
export const taskCollector = (toolbox: string[]) => {
    const tasks: Task[] = []
    const missing: string[] = []
    return {
        tasks,
        /** Adds a mandatory task; returns its index, or null when the block is missing. */
        add: (cell: Cell, action: string, after: number[] = []): number | null => {
            if (!toolbox.includes(action)) {
                if (!missing.includes(action)) missing.push(action)
                return null
            }
            return tasks.push({ cell, action, after }) - 1
        },
        result: (notes: TaskPlan['notes'] = []): TaskPlan | SolverFailure =>
            missing.length ? { kind: 'missingBlocks', blocks: missing } : { tasks, notes }
    }
}

/** A map without objects that is already won has nothing to solve. */
export const hasNothingToDo = (grid: Grid, won: SceneModel['won']) =>
    grid.objects.length === 0 && won(initialState(grid))

/** planTasks for scenes where each object simply needs its own block, in any order. */
export const planOnePerObject = (won: SceneModel['won'], actionByLetter: Record<string, string>): SceneModel['planTasks'] =>
    (grid, toolbox) => {
        if (hasNothingToDo(grid, won)) return { kind: 'nothingToDo' }
        const collector = taskCollector(toolbox)
        grid.objects.forEach(({ cell, letter }) => collector.add(cell, actionByLetter[letter]))
        return collector.result()
    }

const act = (state: SimState, rule: ActionRule): SimulationFailure | null => {
    if (rule.engineError) return 'engineError'
    const target = state.objects.find(object =>
        sameCell(object.cell, state.position) && object.letter === rule.letter &&
        (object.status === 'present' || (rule.effect === 'markOnce' && object.status === 'done')))
    if (!target) return 'nothingHere'
    if (target.status === 'done') return 'alreadyDone'
    const failure = rule.extraCheck?.(state)
    if (failure) return failure
    target.status = rule.effect === 'remove' ? 'removed' : 'done'
    rule.onDone?.(state)
    return null
}

const move = (grid: Grid, state: SimState, token: string): SimulationFailure | null => {
    const delta = DELTA[MOVES[token]]
    const destination = { row: state.position.row + delta.row, column: state.position.column + delta.column }
    if (!cellExists(grid, destination)) return 'outOfBoard'
    if (grid.obstacle[destination.row][destination.column]) return 'obstacle'
    state.position = destination
    return null
}

const isKnownLetter = (model: SceneModel, letter: string) =>
    [ACTOR, OBSTACLE, EMPTY].includes(letter) || model.letters.includes(letter)

/** Runs a flat list of tokens on a map with the engine's rules. Throws if the map cannot be read. */
export const simulateWith = (model: SceneModel, map: string[][], actions: string[]): SimulationResult => {
    const grid = parseMap(map)
    if (grid.objects.some(({ letter }) => !isKnownLetter(model, letter)))
        return { solved: false, reason: 'unknownCell', step: -1 }

    const state = initialState(grid)
    for (let step = 0; step < actions.length; step++) {
        const token = actions[step]
        const failure = Object.prototype.hasOwnProperty.call(MOVES, token) ? move(grid, state, token)
            : Object.prototype.hasOwnProperty.call(model.actions, token) ? act(state, model.actions[token])
                : 'unknownBlock'
        if (failure) return { solved: false, reason: failure, step }
    }
    return model.won(state) ? { solved: true } : { solved: false, reason: 'notSolved', step: actions.length }
}

/** The model of each character the solver supports. A function, so the import cycle with the scenes is harmless. */
export const modelFor = (type: SceneType): SceneModel | undefined => {
    const models: Partial<Record<SceneType, SceneModel>> = {
        Duba: dubaModel
    }
    return models[type]
}
