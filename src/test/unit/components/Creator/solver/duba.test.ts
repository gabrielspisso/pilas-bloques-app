import { modelFor, simulateWith } from "../../../../../components/creator/solver/sceneModel"
import { parseMap } from "../../../../../components/creator/solver/grid"
import { L, MOVES4, R } from "./helpers"

const duba = modelFor('Duba')!
const run = (map: string[][], actions: string[]) => simulateWith(duba, map, actions)

describe("Duba simulator", () => {
    const map = [["A", "-", "P"]]

    test("walking to the steak and eating it solves the scene", () => {
        expect(run(map, [R, R, 'ComerChurrasco'])).toEqual({ solved: true })
        expect(run(map, ['MoverA:ParaLaDerecha', 'MoverA:ParaLaDerecha', 'ComerChurrasco'])).toEqual({ solved: true })
    })

    test("engine errors", () => {
        expect(run(map, [R, 'ComerChurrasco'])).toEqual({ solved: false, reason: 'nothingHere', step: 1 })
        expect(run(map, [L])).toEqual({ solved: false, reason: 'outOfBoard', step: 0 })
        expect(run([["A", "O"]], [R])).toEqual({ solved: false, reason: 'obstacle', step: 0 })
        expect(run([["A", "_", "P"]], [R])).toEqual({ solved: false, reason: 'outOfBoard', step: 0 })
        expect(run(map, [R, R, 'ComerChurrasco', 'ComerChurrasco'])).toEqual({ solved: false, reason: 'nothingHere', step: 3 })
        expect(run(map, ['RecogerLata'])).toEqual({ solved: false, reason: 'unknownBlock', step: 0 })
    })

    test("not eating everything does not solve it", () => {
        expect(run(map, [])).toEqual({ solved: false, reason: 'notSolved', step: 0 })
    })

    test("unknown letters are rejected", () => {
        expect(run([["A", "X"]], [])).toEqual({ solved: false, reason: 'unknownCell', step: -1 })
    })
})

describe("Duba planTasks", () => {
    test("needs the eating block", () => {
        expect(duba.planTasks(parseMap([["A", "P", "P"]]), MOVES4))
            .toEqual({ kind: 'missingBlocks', blocks: ['ComerChurrasco'] })
    })

    test("one task per steak; nothing to do without steaks", () => {
        expect(duba.planTasks(parseMap([["A", "P"]]), ['ComerChurrasco']))
            .toEqual({ tasks: [{ cell: { row: 0, column: 1 }, action: 'ComerChurrasco', after: [] }], notes: [] })
        expect(duba.planTasks(parseMap([["A", "-"]]), MOVES4)).toEqual({ kind: 'nothingToDo' })
    })
})
