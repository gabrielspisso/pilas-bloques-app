import { SerializedChallenge } from "../../serializedChallenge"
import { findActions } from "./findSolution"
import { parseMap } from "./grid"
import { countBlocks, flatten, optimizeProgram, rawProgram } from "./optimize"
import { programToXml } from "./programXml"
import { checkAssessments } from "./assessmentCheck"
import { SceneModel, modelFor, simulateWith } from "./sceneModel"
import { Grid, Program, SolverResult } from "./types"

const readMap = (map: string[][] | undefined): Grid | null => {
    try {
        return map ? parseMap(map) : null
    } catch {
        return null
    }
}

const solves = (model: SceneModel, map: string[][], tokens: string[]) =>
    !!readMap(map) && simulateWith(model, map, tokens).solved

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
    if (!solves(model, map, found.actions)) return { kind: 'verificationFailed' }

    let program: Program = optimizeProgram(found.actions, toolbox, challenge.assesments, procedureName)
    if (!solves(model, map, flatten(program))) {
        program = rawProgram(found.actions)
        if (!solves(model, map, flatten(program))) return { kind: 'verificationFailed' }
    }

    const tokens = flatten(program)
    return {
        kind: 'solved',
        program,
        xml: programToXml(program),
        rawSteps: found.actions.length,
        blocks: countBlocks(program),
        exactOrder: found.exactOrder,
        scenarioIndex,
        scenarios: maps.map((other, index) => ({ index, solved: solves(model, other, tokens) })),
        warnings: checkAssessments(program, toolbox, challenge.assesments),
        notes: plan.notes
    }
}
