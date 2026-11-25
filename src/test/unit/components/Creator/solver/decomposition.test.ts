import mulang from "mulang"
import { expectationFor } from "../../../../../components/blockly/mulang/challengeExpectations"
import { parseExpect } from "../../../../../components/blockly/mulang/expectations"
import { checkAssessments, countCalls } from "../../../../../components/creator/solver/assessmentCheck"
import { compress, decompose, optimizeProgram, rawProgram } from "../../../../../components/creator/solver/optimize"
import { modelFor, runProgram } from "../../../../../components/creator/solver/sceneModel"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess, Statement } from "../../../../../components/creator/solver/types"
import { Assesments, defaultChallenge } from "../../../../../components/serializedChallenge"
import { programToAst } from "./programToAst"
import { D, MOVES4, PROC, R, REPEAT, U } from "./helpers"

const name = (n: number) => `Parte ${n}`
const solve = (map: string[][], blocks: string[], assesments: Assesments) => solveChallenge(
    { ...defaultChallenge('Duba'), toolbox: { blocks }, assesments, scene: { type: 'Duba', maps: [map] } }, 0, name) as SolverSuccess
const repeats = (statements: Statement[]) => statements.filter(s => s.kind === 'repeat')

describe("simple repetition", () => {
    const assesments = { simpleRepetition: true }
    const toolbox = [...MOVES4, 'ComerChurrasco']

    test("repeats on a tie", () => {
        expect(compress(['D', 'D'], true, { preferRepeatOnTie: true }))
            .toEqual({ cost: 2, statements: [{ kind: 'repeat', times: 2, body: [{ kind: 'action', block: 'D' }] }] })
        expect(compress(['A', 'D', 'D', 'B'], true, { preferRepeatOnTie: true }).statements.map(s => s.kind))
            .toEqual(['action', 'repeat', 'action'])
    })

    test("uses a Repeat to meet the assessment", () => {
        const result = solve([["A", "-", "P"]], [...toolbox, REPEAT], assesments)
        expect(repeats(result.program.main)).toHaveLength(1)
        expect(result.warnings).toEqual([])
    })

    test("says why it cannot", () => {
        expect(solve([["A", "-", "P"]], toolbox, assesments).warnings).toEqual([{ id: 'noRepetition', reason: 'missingBlock' }])
        expect(solve([["A&P"]], [...toolbox, REPEAT], assesments).warnings).toEqual([{ id: 'noRepetition', reason: 'nothingRepeats' }])
    })
})

describe("forced decomposition", () => {
    const assesments = { decomposition: { maxProgramLength: 4 } }
    const map = [["A", "T", "-", "E", "P"], ["-", "E", "P", "T", "-"]]
    const tokens = [R, 'RepararTelescopio', D, 'ObservarEstrella', R, 'ObservarPlaneta',
        R, 'RepararTelescopio', U, 'ObservarEstrella', R, 'ObservarPlaneta']

    test("splits the program until every declaration fits", () => {
        const program = optimizeProgram(tokens, [...MOVES4, PROC], assesments, name)

        expect(checkAssessments(program, [PROC], assesments)).toEqual([])
        expect(countCalls(program.main)).toBeLessThanOrEqual(3)
        program.procedures.forEach(({ body }) => expect(countCalls(body)).toBeLessThanOrEqual(3))
        expect(runProgram(modelFor('Manic')!, map, program)).toMatchObject({ solved: true, executed: tokens })

        // The expectations the app builds for a creator challenge, run by the real Mulang.
        const workspace = {
            getAllBlocks: () => program.procedures.map(p => ({ type: 'procedures_defnoreturn', getFieldValue: () => p.name }))
        } as any
        const edl = expectationFor({ id: 0, expectations: { decomposition: true }, maxProgramLength: 4 }, workspace)
        const results: [string, boolean][] = (mulang as any).astCode(programToAst(program)).customExpect(edl)
        expect(results.length).toBeGreaterThan(program.procedures.length)
        expect(results.filter(([, passed]) => !passed).map(([id]) => parseExpect(window.atob(id)))).toEqual([])
        expect(program.procedures.length).toBeGreaterThan(1)
    })

    test("splits the body of a long repetition inside it", () => {
        const body: Statement[] = ['a', 'b', 'c', 'd', 'e'].map(block => ({ kind: 'action', block }))
        const program = decompose({ main: [{ kind: 'repeat', times: 2, body }], procedures: [] }, 3, name)
        expect(program.main).toEqual([{ kind: 'repeat', times: 2, body: [{ kind: 'call', name: 'Parte 1' }, { kind: 'call', name: 'Parte 2' }] }])
        expect(checkAssessments(program, [PROC], assesments)).toEqual([])
    })

    test("equal stretches share a procedure, and a too small limit ends", () => {
        const same = decompose(rawProgram(['a', 'b', 'a', 'b']), 2, name)
        expect(same.procedures).toHaveLength(1)
        expect(decompose(rawProgram(['a', 'b', 'c']), 1, name)).toEqual(rawProgram(['a', 'b', 'c']))
    })

    test("without Procedures in the toolbox it says so", () => {
        const result = solve([["A", "-", "-", "-", "P"]], [...MOVES4, 'ComerChurrasco'], assesments)
        expect(result.warnings.map(w => w.id)).toEqual(['mainTooLong', 'decompositionMissingBlock'])
    })
})
