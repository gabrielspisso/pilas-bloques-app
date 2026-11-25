import { SceneType } from "../../serializedChallenge"
import { ACTOR, EMPTY, OBSTACLE } from "../Editor/SceneEdition/mapUtils"
import { MOVES, cellExists, insideGrid, parseMap, sameCell } from "./grid"
import { capyModel } from "./scenes/capy"
import { chuyModel } from "./scenes/chuy"
import { dubaModel } from "./scenes/duba"
import { litaModel } from "./scenes/lita"
import { manicModel } from "./scenes/manic"
import { yvotyModel } from "./scenes/yvoty"
import { Cell, DELTA, Direction, Grid, Program, SimulationFailure, SimulationResult, SolverFailure, Statement, Task, TaskPlan } from "./types"

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
    /** object sensor block id -> letter it detects */
    sensors: Record<string, string>
    /** letters that animate away after their action: a sensor on them is not reliable afterwards */
    vanishing: string[]
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

const BORDER_SENSORS: Record<string, Direction> = {
    BordeDerecho: 'right', BordeAbajo: 'down', BordeIzquierdo: 'left', BordeArriba: 'up'
}
const OBSTACLE_SENSORS: Record<string, Direction> = {
    HayObstaculoDerecha: 'right', HayObstaculoAbajo: 'down', HayObstaculoIzquierda: 'left', HayObstaculoArriba: 'up'
}

const neighbour = (cell: Cell, direction: Direction): Cell =>
    ({ row: cell.row + DELTA[direction].row, column: cell.column + DELTA[direction].column })

const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key)

/** The value of a sensor block where the character stands, or why the engine cannot give a reliable one. */
const sense = (model: SceneModel, grid: Grid, state: SimState, sensor: string): boolean | SimulationFailure => {
    if (has(BORDER_SENSORS, sensor)) return !insideGrid(grid, neighbour(state.position, BORDER_SENSORS[sensor]))
    if (has(OBSTACLE_SENSORS, sensor)) {
        const cell = neighbour(state.position, OBSTACLE_SENSORS[sensor])
        // The engine throws when there is no cell to look at.
        return cellExists(grid, cell) ? grid.obstacle[cell.row][cell.column] : 'sensorError'
    }
    if (!has(model.sensors, sensor)) return 'unknownSensor'
    const letter = model.sensors[sensor]
    const here = state.objects.filter(object => object.letter === letter && sameCell(object.cell, state.position))
    if (here.some(object => object.status === 'present')) return true
    if (here.some(object => object.status === 'done')) return model.vanishing.includes(letter) ? 'indeterminateSensor' : true
    return false
}

/** The sensor block that detects objects with that letter. */
export const sensorFor = (model: SceneModel, letter: string): string | undefined =>
    Object.keys(model.sensors).find(sensor => model.sensors[sensor] === letter)

export const borderSensor = (direction: Direction) =>
    Object.keys(BORDER_SENSORS).find(sensor => BORDER_SENSORS[sensor] === direction)!

export const obstacleSensor = (direction: Direction) =>
    Object.keys(OBSTACLE_SENSORS).find(sensor => OBSTACLE_SENSORS[sensor] === direction)!

export const MAX_ACTIONS = 5000

export type ProgramRun = SimulationResult & {
    /** every sensor evaluation, in order */
    trace: { sensor: string, value: boolean, node: Statement }[]
    /** how many times the body ran, for every execution of every "until" */
    loops: { node: Statement, times: number }[]
    /** the tokens that were executed successfully */
    executed: string[]
    position: Cell
}

/**
 * Runs a program on a map with the engine's rules. Throws if the map cannot be read.
 * `step` is the number of actions executed before the failure.
 */
export const runProgram = (model: SceneModel, map: string[][], program: Program, maxActions = MAX_ACTIONS): ProgramRun => {
    const grid = parseMap(map)
    const state = initialState(grid)
    const trace: ProgramRun['trace'] = []
    const loops: ProgramRun['loops'] = []
    const executed: string[] = []
    // Loop turns and calls are limited too: an empty body or a recursion would never reach maxActions.
    let turns = 0

    const finish = (result: SimulationResult): ProgramRun => ({ ...result, trace, loops, executed, position: state.position })
    if (grid.objects.some(({ letter }) => !isKnownLetter(model, letter)))
        return finish({ solved: false, reason: 'unknownCell', step: -1 })

    const turn = (): SimulationFailure | null => ++turns > maxActions ? 'tooManySteps' : null

    const evaluate = (statement: Statement & { sensor: string }): boolean | SimulationFailure => {
        const value = sense(model, grid, state, statement.sensor)
        if (typeof value === 'boolean') trace.push({ sensor: statement.sensor, value, node: statement })
        return value
    }

    const run = (statements: Statement[]): SimulationFailure | null => {
        for (const statement of statements) {
            const failure = runStatement(statement)
            if (failure) return failure
        }
        return null
    }

    const runStatement = (statement: Statement): SimulationFailure | null => {
        switch (statement.kind) {
            case 'action': {
                if (executed.length >= maxActions) return 'tooManySteps'
                const token = statement.block
                const failure = has(MOVES, token) ? move(grid, state, token)
                    : has(model.actions, token) ? act(state, model.actions[token])
                        : 'unknownBlock'
                if (!failure) executed.push(token)
                return failure
            }
            case 'call': {
                const procedure = program.procedures.find(({ name }) => name === statement.name)
                return procedure ? turn() ?? run(procedure.body) : 'unknownBlock'
            }
            case 'repeat': {
                for (let i = 0; i < statement.times; i++) {
                    const failure = turn() ?? run(statement.body)
                    if (failure) return failure
                }
                return null
            }
            case 'if': {
                const value = evaluate(statement)
                if (typeof value !== 'boolean') return value
                return value ? run(statement.body) : null
            }
            case 'until': {
                for (let times = 0; ; times++) {
                    const value = evaluate(statement)
                    if (typeof value !== 'boolean') return value
                    if (value) {
                        loops.push({ node: statement, times })
                        return null
                    }
                    const failure = turn() ?? run(statement.body)
                    if (failure) return failure
                }
            }
        }
    }

    const failure = run(program.main)
    if (failure) return finish({ solved: false, reason: failure, step: executed.length })
    return finish(model.won(state) ? { solved: true } : { solved: false, reason: 'notSolved', step: executed.length })
}

/** Runs a flat list of tokens. Throws if the map cannot be read. */
export const simulateWith = (model: SceneModel, map: string[][], actions: string[]): SimulationResult => {
    const run = runProgram(model, map, { main: actions.map(block => ({ kind: 'action', block })), procedures: [] },
        Math.max(MAX_ACTIONS, actions.length))
    return run.solved ? { solved: true } : { solved: false, reason: run.reason, step: run.step }
}

/** The model of each character the solver supports. A function, so the import cycle with the scenes is harmless. */
export const modelFor = (type: SceneType): SceneModel | undefined => {
    const models: Partial<Record<SceneType, SceneModel>> = {
        Duba: dubaModel,
        Capy: capyModel,
        Manic: manicModel,
        Lita: litaModel,
        Chuy: chuyModel,
        Yvoty: yvotyModel
    }
    return models[type]
}
