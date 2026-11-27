import { SceneType, defaultChallenge } from "../../../../../components/serializedChallenge"
import { modelFor, simulateWith } from "../../../../../components/creator/solver/sceneModel"
import { flatten } from "../../../../../components/creator/solver/optimize"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess } from "../../../../../components/creator/solver/types"
import { D, MOVES4, R, REPEAT } from "./helpers"

const type: SceneType = 'Lita'
const run = (map: string[][], actions: string[]) => simulateWith(modelFor(type)!, map, actions)
const solve = (map: string[][], blocks: string[]) =>
    solveChallenge({ ...defaultChallenge(type), toolbox: { blocks }, scene: { type, maps: [map] } }, 0, n => `Parte ${n}`)

describe("Lita", () => {
    /** The reference screenshot of the plan. */
    const captured = [["A", "O", "-", "-"], ["-", "O", "-", "-"], ["-", "-", "-", "-"], ["L", "-", "-", "T"]]
    const walk = [D, D, D, 'AgarrarLechuga', R, R, R, 'AgarrarTomate']
    const salad = [["A", "L", "E"]]
    const all = [...MOVES4, 'AgarrarLechuga', 'AgarrarTomate', 'PrepararEnsalada']

    test("without salad bowls, picking every ingredient wins", () => {
        expect(run(captured, walk)).toEqual({ solved: true })
        expect(run(captured, walk.slice(0, -1))).toEqual({ solved: false, reason: 'notSolved', step: 7 })
        expect(run(salad.map(() => ["A", "T"]), [R, 'AgarrarLechuga'])).toEqual({ solved: false, reason: 'nothingHere', step: 1 })
        expect(run([["A", "L"]], [R, 'AgarrarTomate'])).toEqual({ solved: false, reason: 'nothingHere', step: 1 })
    })

    test("with a salad bowl, it has to be prepared after picking everything", () => {
        expect(run(salad, [R, 'AgarrarLechuga', R, 'PrepararEnsalada'])).toEqual({ solved: true })
        expect(run(salad, [R, R, 'PrepararEnsalada'])).toEqual({ solved: false, reason: 'ingredientsLeft', step: 2 })
        expect(run(salad, [R, 'AgarrarLechuga'])).toEqual({ solved: false, reason: 'notSolved', step: 2 })
        expect(run(salad, ['PrepararEnsalada'])).toEqual({ solved: false, reason: 'nothingHere', step: 0 })
        expect(run([["A&E"]], ['PrepararEnsalada', 'PrepararEnsalada'])).toEqual({ solved: false, reason: 'alreadyDone', step: 1 })
    })

    test("solves the reference board with the exact route", () => {
        const result = solve(captured, [...MOVES4, 'AgarrarLechuga', 'AgarrarTomate', REPEAT]) as SolverSuccess
        expect(result).toMatchObject({ kind: 'solved', blocks: 6, rawSteps: 8 })
        expect(flatten(result.program)).toEqual(walk)
    })

    test("official challenge 217: the salad comes last", () => {
        const result = solve([["-", "-", "-", "-"], ["-", "L", "T", "-"], ["A", "-", "-", "E"], ["-", "-", "-", "-"]], all) as SolverSuccess
        const tokens = flatten(result.program)
        expect(tokens).toHaveLength(8)
        expect(tokens[7]).toBe('PrepararEnsalada')
    })

    test("prepares every salad bowl, after the ingredients", () => {
        const result = solve([["A", "L", "E", "E"]], all) as SolverSuccess
        const tokens = flatten(result.program)
        expect(tokens.filter(t => t === 'PrepararEnsalada')).toHaveLength(2)
        expect(tokens.indexOf('PrepararEnsalada')).toBeGreaterThan(tokens.indexOf('AgarrarLechuga'))
    })

    test("a salad bowl next to the start waits for the ingredients", () => {
        const result = solve([["A", "E", "L"]], all) as SolverSuccess
        expect(flatten(result.program)).toEqual([R, R, 'AgarrarLechuga', 'MoverACasillaIzquierda', 'PrepararEnsalada'])
    })

    test("needs the salad block when there is a bowl", () => {
        expect(solve(salad, [...MOVES4, 'AgarrarLechuga'])).toEqual({ kind: 'missingBlocks', blocks: ['PrepararEnsalada'] })
    })
})
