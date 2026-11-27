import { SceneType, defaultChallenge } from "../../../../../components/serializedChallenge"
import { modelFor, simulateWith } from "../../../../../components/creator/solver/sceneModel"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { descriptorToMap } from "./descriptorToMap"
import { MOVES4, PROC, R } from "./helpers"
import { officialSolutions } from "./officialSolutions"

const type: SceneType = 'Capy'
const run = (map: string[][], actions: string[]) => simulateWith(modelFor(type)!, map, actions)
const solve = (map: string[][], blocks: string[]) =>
    solveChallenge({ ...defaultChallenge(type), toolbox: { blocks }, scene: { type, maps: [map] } }, 0, n => `Parte ${n}`)

describe("Capy", () => {
    const map = [["A", "L", "P"]]

    test("each object needs its own block, once", () => {
        expect(run(map, [R, 'RecogerLata', R, 'RecogerPapel'])).toEqual({ solved: true })
        expect(run(map, [R, 'RecogerLata', 'RecogerLata'])).toEqual({ solved: false, reason: 'alreadyDone', step: 2 })
        expect(run(map, [R, 'RecogerPapel'])).toEqual({ solved: false, reason: 'nothingHere', step: 1 })
        expect(run(map, [R, 'RecogerLata'])).toEqual({ solved: false, reason: 'notSolved', step: 2 })
    })

    test("solves the board", () => {
        expect(solve(map, [...MOVES4, 'RecogerLata', 'RecogerPapel'])).toMatchObject({ kind: 'solved', rawSteps: 4 })
        expect(solve(map, MOVES4)).toEqual({ kind: 'missingBlocks', blocks: ['RecogerLata', 'RecogerPapel'] })
        expect(solve([["A", "-"]], MOVES4)).toEqual({ kind: 'nothingToDo' })
    })

    test("solves the board of the official challenge 1046, with its missing cells", () => {
        const official = descriptorToMap(officialSolutions.find(s => s.id === 1046)!.descriptor)
        expect(official.flat()).toContain('_')
        expect(solve(official, [...MOVES4, 'RecogerLata', PROC])).toMatchObject({ kind: 'solved' })
    })
})
