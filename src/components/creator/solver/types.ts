import { SceneType } from "../../serializedChallenge"

export type Cell = { row: number, column: number }
export type Direction = 'right' | 'down' | 'left' | 'up'
/** Fixed order = deterministic ties. */
export const DIRECTIONS: Direction[] = ['right', 'down', 'left', 'up']
export const DELTA: Record<Direction, Cell> = {
    right: { row: 0, column: 1 },
    down: { row: 1, column: 0 },
    left: { row: 0, column: -1 },
    up: { row: -1, column: 0 }
}

/** A move the toolbox allows. token is what phase 2 compresses and the simulator runs. */
export type MoveOption = { direction: Direction, token: string }

export type Grid = {
    rows: number, columns: number,
    /** false for '_' cells (only in official maps) */
    exists: boolean[][],
    obstacle: boolean[][],
    start: Cell,
    /** every non-actor, non-obstacle letter, row by row */
    objects: { cell: Cell, letter: string }[]
}

/** One thing to do: run `action` standing on `cell`, after every task listed in `after` (indexes). */
export type Task = { cell: Cell, action: string, after: number[] }

export type SolverNote =
    | { id: 'paddleNotRequired' | 'chargerNotRequired', cells: Cell[] }
    | { id: 'untilWithOneScenario' }
    | { id: 'commonProgram', scenarios: number }
    | { id: 'scenariosIncompatible', reason: 'size' | 'start' | 'obstacleConflict' }
    | { id: 'commonNeedsBlocks', blocks: string[] }

export type TaskPlan = { tasks: Task[], notes: SolverNote[] }

export type Statement =
    /** block = a move token (see MoveOption) or an action block id */
    | { kind: 'action', block: string }
    | { kind: 'call', name: string }
    | { kind: 'repeat', times: number, body: Statement[] }
    /** Blockly 'Si' */
    | { kind: 'if', sensor: string, body: Statement[] }
    /** Blockly 'Hasta': while (!sensor) body */
    | { kind: 'until', sensor: string, body: Statement[] }
export type Procedure = { name: string, body: Statement[] }
export type Program = { main: Statement[], procedures: Procedure[] }

export type SimulationFailure = 'outOfBoard' | 'obstacle' | 'nothingHere' | 'alreadyDone' | 'ingredientsLeft' | 'chargersLeft' | 'engineError' | 'notSolved' | 'unknownBlock' | 'unknownCell' | 'unknownSensor' | 'sensorError' | 'indeterminateSensor' | 'tooManySteps'
export type SimulationResult = { solved: true } | { solved: false, reason: SimulationFailure, step: number }

export type SolverFailure =
    | { kind: 'unsupportedScene', type: SceneType }
    | { kind: 'invalidMap' }
    | { kind: 'nothingToDo' }
    | { kind: 'missingBlocks', blocks: string[] }
    | { kind: 'engineLimitation', id: 'pingPong', cells: Cell[] }
    | { kind: 'unreachable', cells: Cell[] }
    | { kind: 'noRoute' }
    | { kind: 'verificationFailed' }

export type AssessmentWarning =
    | { id: 'mainTooLong', count: number, max: number, allowed: number }
    | { id: 'procedureTooLong', name: string, count: number, max: number, allowed: number }
    | { id: 'nestedControl', name: string | null }
    | { id: 'noRepetition', reason: 'missingBlock' | 'nothingRepeats' }
    | { id: 'needsConditionalRepetition', reason: 'missingBlocks' | 'noLandmark' | 'notYet', blocks?: string[] }
    | { id: 'needsConditionalAlternative', reason: 'missingBlocks' | 'nothingToDecide' | 'incompatibleScenarios' | 'notYet', blocks?: string[] }
    | { id: 'decompositionMissingBlock' }

export type SolverSuccess = {
    kind: 'solved', program: Program, xml: string,
    rawSteps: number, blocks: number, exactOrder: boolean,
    scenarioIndex: number, scenarios: { index: number, solved: boolean }[],
    warnings: AssessmentWarning[], notes: SolverNote[]
}
export type SolverResult = SolverSuccess | SolverFailure
