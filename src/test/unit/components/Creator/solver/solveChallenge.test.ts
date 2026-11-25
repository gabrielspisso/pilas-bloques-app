import { SceneType, defaultChallenge } from "../../../../../components/serializedChallenge"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess } from "../../../../../components/creator/solver/types"
import { MOVES4, REPEAT } from "./helpers"
import { xmlToProgram } from "./xmlToProgram"

const name = (n: number) => `Parte ${n}`
const solve = (type: SceneType, maps: string[][][], blocks: string[], index = 0) =>
    solveChallenge({ ...defaultChallenge('Duba'), scene: { type, maps }, toolbox: { blocks } }, index, name)

describe("solveChallenge", () => {
    const toolbox = [...MOVES4, 'ComerChurrasco']
    const line = [["A", "-", "-", "P"]]

    test("returns a verified program with its XML", () => {
        const result = solve('Duba', [line], [...toolbox, REPEAT]) as SolverSuccess
        expect(result).toMatchObject({ kind: 'solved', blocks: 3, rawSteps: 4, exactOrder: true, warnings: [], notes: [], scenarios: [{ index: 0, solved: true }] })
        expect(xmlToProgram(result.xml)).toEqual(result.program)
    })

    test("without Repeat in the toolbox it does not use it", () => {
        expect(solve('Duba', [line], toolbox)).toMatchObject({ kind: 'solved', blocks: 4 })
    })

    test("says in which scenarios the program works", () => {
        expect(solve('Duba', [line, [["A", "-", "P", "-"]]], toolbox))
            .toMatchObject({ scenarios: [{ index: 0, solved: true }, { index: 1, solved: false }] })
    })

    test("failures", () => {
        expect(solve('Duba', [[["P", "-"]]], toolbox)).toEqual({ kind: 'invalidMap' })
        expect(solve('Duba', [[["A", "X"]]], toolbox)).toEqual({ kind: 'invalidMap' })
        expect(solve('Custom', [line], toolbox)).toEqual({ kind: 'unsupportedScene', type: 'Custom' })
        expect(solve('Duba', [[["A", "-"]]], toolbox)).toEqual({ kind: 'nothingToDo' })
    })
})
