import { SerializedChallenge } from "../../serializedChallenge"
import { commonPuzzle, everyIfDecides } from "./commonProgram"
import { findActions } from "./findSolution"
import { parseMap } from "./grid"
import { countBlocks, optimizeProgram, rawProgram } from "./optimize"
import { programToXml } from "./programXml"
import { ConditionalReasons, checkAssessments } from "./assessmentCheck"
import { ProgramRun, SceneModel, modelFor, runProgram, simulateWith } from "./sceneModel"
import { Grid, Program, SolverNote, SolverResult, SolverSuccess, TaskPlan } from "./types"
import { untilPass } from "./untilPass"

const readMap = (map: string[][] | undefined): Grid | null => {
    try {
        return map ? parseMap(map) : null
    } catch {
        return null
    }
}

const solves = (model: SceneModel, map: string[][], program: Program) =>
    !!readMap(map) && runProgram(model, map, program).solved

type Attempt = { solution: SolverSuccess } | { solution: null, notes: SolverNote[], alternative: ConditionalReasons['alternative'] }

type Context = {
    model: SceneModel, challenge: SerializedChallenge, toolbox: string[], procedureName: (n: number) => string
}

type Puzzle = {
    grid: Grid, plan: TaskPlan,
    /** scenarios the program has to solve */
    targets: string[][][]
    /** extra condition on the runs over the targets */
    accepts?: (runs: ProgramRun[]) => boolean
}

/** Phases 1 and 2 and the "until" pass, with every program checked on every target scenario. */
const solvePuzzle = ({ model, challenge, toolbox, procedureName }: Context, { grid, plan, targets, accepts = () => true }: Puzzle) => {
    const found = findActions(grid, plan, toolbox)
    if ('kind' in found) return found

    const works = (program: Program) => {
        const runs = targets.map(map => runProgram(model, map, program))
        return runs.every(run => run.solved) && accepts(runs)
    }
    const raw = rawProgram(found.actions)
    if (!works(raw)) return { kind: 'verificationFailed' } as const

    let program: Program = optimizeProgram(found.actions, toolbox, challenge.assesments, procedureName)
    if (!works(program)) program = raw

    const reasons: ConditionalReasons = {}
    let converted = false
    if (challenge.assesments?.conditionalRepetition) {
        const solved = challenge.scene.maps.filter(map => solves(model, map, program))
        const until = untilPass(model, program, solved, toolbox, challenge.assesments)
        if (until.converted === false) reasons.repetition = { reason: until.reason, blocks: until.blocks }
        else if (works(until.program)) {
            program = until.program
            converted = true
        }
    }
    return { kind: 'puzzle' as const, program, reasons, converted, found }
}

type Solved = Extract<ReturnType<typeof solvePuzzle>, { kind: 'puzzle' }>

const success = ({ model, challenge, toolbox }: Context, { program, reasons, found }: Solved, scenarioIndex: number, notes: SolverNote[]): SolverSuccess => ({
    kind: 'solved',
    program,
    xml: programToXml(program),
    rawSteps: found.actions.length,
    blocks: countBlocks(program),
    exactOrder: found.exactOrder,
    scenarioIndex,
    scenarios: challenge.scene.maps.map((map, index) => ({ index, solved: solves(model, map, program) })),
    warnings: checkAssessments(program, toolbox, challenge.assesments, reasons),
    notes
})

/** One program for every scenario, when they are compatible and the toolbox allows it. */
const solveAllScenarios = (context: Context, scenarioIndex: number): Attempt => {
    const { model, challenge, toolbox } = context
    const { maps } = challenge.scene
    const failed = (alternative: ConditionalReasons['alternative'], ...notes: SolverNote[]): Attempt => ({ solution: null, notes, alternative })

    if (maps.some(map => !readMap(map))) return failed({ reason: 'notYet' })
    const common = commonPuzzle(model, maps, toolbox)
    if (common.kind === 'incompatible')
        return failed({ reason: 'incompatibleScenarios' }, { id: 'scenariosIncompatible', reason: common.reason })
    if (common.kind === 'needsBlocks' || common.kind === 'missingBlocks')
        return failed({ reason: 'missingBlocks', blocks: common.blocks }, { id: 'commonNeedsBlocks', blocks: common.blocks })
    if (common.kind !== 'puzzle') return failed({ reason: 'notYet' })

    const solved = solvePuzzle(context, { grid: common.grid, plan: common.plan, targets: maps, accepts: everyIfDecides })
    if (solved.kind !== 'puzzle') return failed({ reason: 'notYet' })

    if (!common.conditional) solved.reasons.alternative = { reason: 'nothingToDecide' }
    const notes: SolverNote[] = common.conditional ? [{ id: 'commonProgram', scenarios: maps.length }] : []
    return { solution: success(context, solved, scenarioIndex, [...common.plan.notes, ...notes]) }
}

/**
 * A recommended solution for the challenge, using only the blocks of the toolbox and checked against
 * the simulated engine rules before it is returned: one program for every scenario when possible,
 * otherwise one for the scenario being edited.
 */
export const solveChallenge = (challenge: SerializedChallenge, scenarioIndex: number, procedureName: (n: number) => string): SolverResult => {
    const { type, maps } = challenge.scene
    const toolbox = challenge.toolbox.blocks
    const model = modelFor(type)
    if (!model) return { kind: 'unsupportedScene', type }
    const context: Context = { model, challenge, toolbox, procedureName }

    const common = maps.length > 1 ? solveAllScenarios(context, scenarioIndex) : null
    if (common?.solution) return common.solution

    const map = maps[scenarioIndex]
    const grid = readMap(map)
    if (!grid) return { kind: 'invalidMap' }

    const untouched = simulateWith(model, map, [])
    // Letters the character does not know (only possible in a hand-made file).
    if (!untouched.solved && untouched.reason === 'unknownCell') return { kind: 'invalidMap' }
    if (untouched.solved && !grid.objects.length) return { kind: 'nothingToDo' }

    const plan = model.planTasks(grid, toolbox)
    if ('kind' in plan) return plan
    if (!plan.tasks.length && !untouched.solved) return { kind: 'nothingToDo' }

    const solved = solvePuzzle(context, { grid, plan, targets: [map] })
    if (solved.kind !== 'puzzle') return solved

    // With a single scenario there is nothing an "If" could decide.
    solved.reasons.alternative = common?.solution === null ? common.alternative : { reason: 'nothingToDecide' }
    const notes: SolverNote[] = [...plan.notes, ...(common?.solution === null ? common.notes : [])]
    if (solved.converted && maps.length === 1) notes.push({ id: 'untilWithOneScenario' })
    return success(context, solved, scenarioIndex, notes)
}
