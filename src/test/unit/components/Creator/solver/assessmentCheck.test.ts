import mulang from "mulang"
import { entryPointType } from "../../../../../components/blockly/mulang/blockUtils"
import { declarationDoesNotNestControlStructures, doSomething, doesNotUseRecursion, isUsed, isUsedFromMain, mainNotTooLong, mainTooLongId, multiExpect, nameWasChanged, notTooLong, parseExpect } from "../../../../../components/blockly/mulang/expectations"
import { checkAssessments, countCalls } from "../../../../../components/creator/solver/assessmentCheck"
import { optimizeProgram, rawProgram } from "../../../../../components/creator/solver/optimize"
import { Program, Statement } from "../../../../../components/creator/solver/types"
import { application, entryPoint, number, procedure, rawSequence, repeat } from "../../blockly/mulang/astFactories"
import { PROC, REPEAT } from "./helpers"

const name = (n: number) => `Parte ${n}`
const decomposition = { decomposition: { maxProgramLength: 7 } }
const actions = (...blocks: string[]): Statement[] => blocks.map(block => ({ kind: 'action', block }))
const move = 'MoverA:ParaLaDerecha'

const toAst = (statement: Statement): any => {
    switch (statement.kind) {
        case 'action': {
            const [block, value] = statement.block.split(':')
            return value ? application(block, application(value)) : application(block)
        }
        case 'call': return application(statement.name)
        case 'repeat': return repeat(number(statement.times), ...statement.body.map(toAst))
    }
}

export const programToAst = ({ main, procedures }: Program) => rawSequence([
    entryPoint(entryPointType, ...main.map(toAst)),
    ...procedures.map(p => procedure(p.name, [], ...p.body.map(toAst)))
])

/** Runs EDL expectations with the real Mulang; returns [id, passed]. */
export const runMulang = (program: Program, edl: string): [string, boolean][] =>
    (mulang as any).astCode(programToAst(program)).customExpect(edl)
        .map(([encoded, passed]: [string, boolean]) => [parseExpect(window.atob(encoded))[0], passed])

const decompositionEdl = (program: Program, max: number) => [
    mainNotTooLong(max),
    ...program.procedures.map(p => multiExpect(notTooLong(max), doSomething, isUsed, isUsedFromMain, doesNotUseRecursion, nameWasChanged('Hacer algo'))(p.name)),
    ...[entryPointType, ...program.procedures.map(p => p.name)].map(declarationDoesNotNestControlStructures)
].join('\n')

describe("checkAssessments", () => {
    test("main program too long", () => {
        const program = rawProgram(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
        expect(checkAssessments(program, [], decomposition)).toEqual([{ id: 'mainTooLong', count: 7, max: 7, allowed: 6 }])
    })

    test("'Move to' counts twice", () => {
        expect(countCalls(actions(move, move, move))).toBe(6)
        expect(checkAssessments(rawProgram([move, move, move]), [], decomposition)).toEqual([])
        expect(checkAssessments(rawProgram([move, move, move, move]), [], decomposition))
            .toEqual([{ id: 'mainTooLong', count: 8, max: 7, allowed: 6 }])
    })

    test("long procedures and nested repetitions", () => {
        const inner: Statement = { kind: 'repeat', times: 2, body: actions('a') }
        const program: Program = {
            main: [{ kind: 'repeat', times: 2, body: [inner] }, { kind: 'call', name: 'P' }],
            procedures: [{ name: 'P', body: actions('a', 'b', 'c', 'd', 'e', 'f', 'g') }]
        }
        expect(checkAssessments(program, [REPEAT], decomposition)).toEqual([
            { id: 'procedureTooLong', name: 'P', count: 7, max: 7, allowed: 6 },
            { id: 'nestedControl', name: null }
        ])
    })

    test("repetition and conditionals", () => {
        const program = rawProgram(['a'])
        expect(checkAssessments(program, [REPEAT], { simpleRepetition: true })).toEqual([{ id: 'noRepetition', reason: 'nothingRepeats' }])
        expect(checkAssessments(program, [], { simpleRepetition: true })).toEqual([{ id: 'noRepetition', reason: 'missingBlock' }])
        expect(checkAssessments(program, [], { conditionalAlternative: true })).toEqual([{ id: 'needsConditionalAlternative', reason: 'notYet' }])
        expect(checkAssessments(program, [], { conditionalRepetition: true })).toEqual([{ id: 'needsConditionalRepetition', reason: 'notYet' }])
    })
})

describe("against the real Mulang", () => {
    test("the optimized program meets every decomposition expectation", () => {
        const program = optimizeProgram('a b c d e f a b c d e g a b c d e h'.split(' '), [PROC], decomposition, name)
        const results = runMulang(program, decompositionEdl(program, 7))
        expect(results.length).toBeGreaterThan(5)
        expect(results.filter(([, passed]) => !passed)).toEqual([])
        expect(checkAssessments(program, [PROC], decomposition)).toEqual([])
    })

    test.each([
        ['7 actions', ['a', 'b', 'c', 'd', 'e', 'f', 'g']],
        ["4 'Move to'", [move, move, move, move]]
    ])("agrees that %s is too long", (_, tokens) => {
        const program = rawProgram(tokens)
        expect(runMulang(program, decompositionEdl(program, 7))).toContainEqual([mainTooLongId, false])
        expect(checkAssessments(program, [], decomposition).map(w => w.id)).toEqual(['mainTooLong'])
    })

    test("agrees that 3 'Move to' fit", () => {
        const program = rawProgram([move, move, move])
        expect(runMulang(program, decompositionEdl(program, 7))).toContainEqual([mainTooLongId, true])
    })
})
