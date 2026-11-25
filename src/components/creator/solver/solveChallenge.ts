import { SerializedChallenge } from "../../serializedChallenge"
import { findActions } from "./findSolution"
import { parseMap } from "./grid"
import { countBlocks, optimizeProgram, rawProgram } from "./optimize"
import { programToXml } from "./programXml"
import { ConditionalReasons, checkAssessments } from "./assessmentCheck"
import { SceneModel, modelFor, runProgram, simulateWith } from "./sceneModel"
import { Grid, Program, SolverNote, SolverResult } from "./types"
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

/**
 * A recommended solution for the scenario being edited, using only the blocks of the toolbox
 * and checked against the simulated engine rules before it is returned.
 */
export const solveChallenge = (challenge: SerializedChallenge, scenarioIndex: number, procedureName: (n: number) => string): SolverResult => {
    const { type, maps } = challenge.scene
    const toolbox = challenge.toolbox.blocks
    const model = modelFor(type)
    if (!model) return { kind: 'unsupportedScene', type }

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

    const found = findActions(grid, plan, toolbox)
    if ('kind' in found) return found
    if (!solves(model, map, rawProgram(found.actions))) return { kind: 'verificationFailed' }

    let program: Program = optimizeProgram(found.actions, toolbox, challenge.assesments, procedureName)
    if (!solves(model, map, program)) program = rawProgram(found.actions)

    const notes: SolverNote[] = [...plan.notes]
    const reasons: ConditionalReasons = {}
    if (challenge.assesments?.conditionalRepetition) {
        const solved = maps.filter(other => solves(model, other, program))
        const until = untilPass(model, program, solved, toolbox, challenge.assesments)
        program = until.program
        if (until.converted === false) reasons.repetition = { reason: until.reason, blocks: until.blocks }
        else if (maps.length === 1) notes.push({ id: 'untilWithOneScenario' })
    }

    return {
        kind: 'solved',
        program,
        xml: programToXml(program),
        rawSteps: found.actions.length,
        blocks: countBlocks(program),
        exactOrder: found.exactOrder,
        scenarioIndex,
        scenarios: maps.map((other, index) => ({ index, solved: solves(model, other, program) })),
        warnings: checkAssessments(program, toolbox, challenge.assesments, reasons),
        notes
    }
}
