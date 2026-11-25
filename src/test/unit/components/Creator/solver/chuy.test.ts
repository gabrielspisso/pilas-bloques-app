import { SceneType, defaultChallenge } from "../../../../../components/serializedChallenge"
import { modelFor, simulateWith } from "../../../../../components/creator/solver/sceneModel"
import { flatten } from "../../../../../components/creator/solver/optimize"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess } from "../../../../../components/creator/solver/types"
import { MOVES4, R, cell } from "./helpers"

const type: SceneType = 'Chuy'
const run = (map: string[][], actions: string[]) => simulateWith(modelFor(type)!, map, actions)
const solve = (map: string[][], blocks: string[]) =>
    solveChallenge({ ...defaultChallenge(type), toolbox: { blocks }, scene: { type, maps: [map] } }, 0, n => `Parte ${n}`)

describe("Chuy", () => {
    const map = [["A", "T", "U", "G"]]
    const all = [R, 'RecogerTrofeo', R, 'PatearPulpito', R, 'PatearPelotaChuy']

    test("trophies, rubber balls and footballs", () => {
        expect(run(map, all)).toEqual({ solved: true })
        expect(run(map, [...all, 'PatearPelotaChuy'])).toEqual({ solved: false, reason: 'alreadyDone', step: 6 })
        expect(run(map, [R, 'RecogerTrofeo', 'RecogerTrofeo'])).toEqual({ solved: false, reason: 'nothingHere', step: 2 })
        expect(run(map, [R, 'PatearPulpito'])).toEqual({ solved: false, reason: 'nothingHere', step: 1 })
        expect(run(map, ['PatearPelotaChuy'])).toEqual({ solved: false, reason: 'nothingHere', step: 0 })
        expect(run(map, all.slice(0, -1))).toEqual({ solved: false, reason: 'notSolved', step: 5 })
    })

    test("ping pong balls: the creator's block fails, the official one works", () => {
        expect(run([["A&P"]], ['RebotarUnaVezPingPong'])).toEqual({ solved: false, reason: 'engineError', step: 0 })
        expect(run([["A&P"]], ['RebotarPingPong'])).toEqual({ solved: true })
        expect(run([["A&P"]], [])).toEqual({ solved: false, reason: 'notSolved', step: 0 })
    })

    test("paddles do not count for victory", () => {
        expect(run([["A", "E"]], [])).toEqual({ solved: true })
        expect(run([["A", "E"]], [R, 'RecogerPaleta'])).toEqual({ solved: true })
        expect(run([["A", "E"]], ['RecogerPaleta'])).toEqual({ solved: false, reason: 'nothingHere', step: 0 })
    })

    test("skips the paddles it cannot pick up, and says so", () => {
        const board = [["A", "E", "T"]]
        const skipped = solve(board, [...MOVES4, 'RecogerTrofeo']) as SolverSuccess
        expect(skipped.notes).toEqual([{ id: 'paddleNotRequired', cells: [cell(0, 1)] }])
        expect(flatten(skipped.program)).toEqual([R, R, 'RecogerTrofeo'])

        const picked = solve(board, [...MOVES4, 'RecogerTrofeo', 'RecogerPaleta']) as SolverSuccess
        expect(picked.notes).toEqual([])
        expect(flatten(picked.program)).toEqual([R, 'RecogerPaleta', R, 'RecogerTrofeo'])
    })

    test("explains the ping pong limitation", () => {
        expect(solve([["A", "P"]], [...MOVES4, 'RebotarUnaVezPingPong']))
            .toEqual({ kind: 'engineLimitation', id: 'pingPong', cells: [cell(0, 1)] })
        expect(solve([["A", "P"]], [...MOVES4, 'RebotarPingPong'])).toMatchObject({ kind: 'solved' })
    })

    test("needs the mandatory blocks", () => {
        expect(solve(map, MOVES4)).toEqual({ kind: 'missingBlocks', blocks: ['RecogerTrofeo', 'PatearPulpito', 'PatearPelotaChuy'] })
    })
})
