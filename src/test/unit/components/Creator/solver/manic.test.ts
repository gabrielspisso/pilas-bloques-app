import { SceneType, defaultChallenge } from "../../../../../components/serializedChallenge"
import { modelFor, simulateWith } from "../../../../../components/creator/solver/sceneModel"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess } from "../../../../../components/creator/solver/types"
import { descriptorToMap } from "./descriptorToMap"
import { MOVES4, PROC, R, REPEAT } from "./helpers"
import { officialSolutions } from "./officialSolutions"

const type: SceneType = 'Manic'
const run = (map: string[][], actions: string[]) => simulateWith(modelFor(type)!, map, actions)
const solve = (map: string[][], blocks: string[]) =>
    solveChallenge({ ...defaultChallenge(type), toolbox: { blocks }, scene: { type, maps: [map] } }, 0, n => `Parte ${n}`)

describe("Mañic", () => {
    const map = [["A&T", "E", "P"]]
    const all = ['RepararTelescopio', R, 'ObservarEstrella', R, 'ObservarPlaneta']

    test("each object needs its own block, once", () => {
        expect(run(map, all)).toEqual({ solved: true })
        expect(run(map, ['RepararTelescopio', 'RepararTelescopio'])).toEqual({ solved: false, reason: 'alreadyDone', step: 1 })
        expect(run(map, [R, 'ObservarEstrella', 'ObservarEstrella'])).toEqual({ solved: false, reason: 'alreadyDone', step: 2 })
        expect(run(map, [R, R, 'ObservarPlaneta', 'ObservarPlaneta'])).toEqual({ solved: false, reason: 'alreadyDone', step: 3 })
        expect(run(map, ['ObservarEstrella'])).toEqual({ solved: false, reason: 'nothingHere', step: 0 })
        expect(run(map, ['ObservarPlaneta'])).toEqual({ solved: false, reason: 'nothingHere', step: 0 })
        expect(run(map, all.slice(0, -1))).toEqual({ solved: false, reason: 'notSolved', step: 4 })
    })

    test("solves the board", () => {
        expect(solve(map, [...MOVES4, 'RepararTelescopio', 'ObservarEstrella', 'ObservarPlaneta']))
            .toMatchObject({ kind: 'solved', rawSteps: 5 })
        expect(solve(map, [...MOVES4, 'ObservarEstrella'])).toEqual({ kind: 'missingBlocks', blocks: ['RepararTelescopio', 'ObservarPlaneta'] })
    })

    test("compresses the board of the official challenge 1008", () => {
        const official = descriptorToMap(officialSolutions.find(s => s.id === 1008)!.descriptor)
        const result = solve(official, [...MOVES4, 'ObservarPlaneta', REPEAT, PROC]) as SolverSuccess
        expect(result.kind).toBe('solved')
        expect(result.blocks).toBeLessThan(result.rawSteps)
        console.log(`1008: ${result.rawSteps} steps -> ${result.blocks} blocks, ${result.program.procedures.length} procedures, exact ${result.exactOrder}`)
    })
})
