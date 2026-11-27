import { compress, countBlocks, extractProcedures, flatten, optimizeProgram } from "../../../../../components/creator/solver/optimize"
import { Program, Statement } from "../../../../../components/creator/solver/types"
import { PROC, REPEAT } from "./helpers"

const name = (n: number) => `Parte ${n}`
const words = (text: string) => text.split(' ')
const programOf = (statements: Statement[]): Program => ({ main: statements, procedures: [] })
const nests = (statements: Statement[]): boolean =>
    statements.some(s => s.kind === 'repeat' && s.body.some(inner => inner.kind === 'repeat'))

describe("compress", () => {
    const nested = words('D D D A D D D A D D D A')

    test("uses nested repetitions only when allowed", () => {
        expect(compress(nested, true).cost).toBe(4)
        const flat = compress(nested, false)
        expect(flat.cost).toBe(5)
        expect(nests(flat.statements)).toBe(false)
        expect(flatten(programOf(flat.statements))).toEqual(nested)
        expect(flatten(programOf(compress(nested, true).statements))).toEqual(nested)
    })

    test("does not repeat when it does not pay off", () => {
        expect(compress(['D', 'D'], true)).toEqual({ cost: 2, statements: [{ kind: 'action', block: 'D' }, { kind: 'action', block: 'D' }] })
    })

    test("repeats a longer period", () => {
        const tokens = Array.from({ length: 7 }, () => ['R', 'P']).flat()
        const result = compress(tokens, true)
        expect(result.cost).toBe(3)
        expect(result.statements).toEqual([{ kind: 'repeat', times: 7, body: [{ kind: 'action', block: 'R' }, { kind: 'action', block: 'P' }] }])
    })

    test("'Move to' weighs two blocks", () => {
        const tokens = Array(3).fill('MoverA:ParaLaDerecha')
        const result = compress(tokens, true)
        expect(result.cost).toBe(3)
        expect(countBlocks(programOf(result.statements))).toBe(3)
        expect(compress(tokens, true, { repeat: false }).cost).toBe(6)
    })

    test("very long programs only compress runs", () => {
        const tokens = Array.from({ length: 250 }, (_, i) => i < 100 ? 'D' : `t${i % 7}`)
        const result = compress(tokens, true)
        expect(flatten(programOf(result.statements))).toEqual(tokens)
        expect(result.statements[0]).toEqual({ kind: 'repeat', times: 100, body: [{ kind: 'action', block: 'D' }] })
    })
})

describe("extractProcedures", () => {
    test("turns a repeated stretch into a procedure", () => {
        const tokens = words('a b c d e f a b c d e g a b c d e h')
        const { program, cost } = extractProcedures(tokens, true, name)
        expect(cost).toBe(12)
        expect(countBlocks(program)).toBe(12)
        expect(program.procedures).toEqual([{ name: 'Parte 1', body: words('a b c d e').map(block => ({ kind: 'action', block })) }])
        expect(flatten(program)).toEqual(tokens)
    })

    test("keeps the repetitions when a procedure does not help", () => {
        const tokens = words('a b a b c a b a b d')
        const { program, cost } = extractProcedures(tokens, true, name)
        expect(cost).toBe(8)
        expect(program.procedures).toEqual([])
        expect(flatten(program)).toEqual(tokens)
    })
})

describe("optimizeProgram", () => {
    const tokens = words('a b c d e f a b c d e g a b c d e h')

    test("only uses the blocks of the toolbox", () => {
        expect(countBlocks(optimizeProgram(tokens, [], undefined, name))).toBe(18)
        const withProcedures = optimizeProgram(tokens, [PROC], undefined, name)
        expect(withProcedures.procedures).toHaveLength(1)
        expect(flatten(withProcedures)).toEqual(tokens)
        const repeated = optimizeProgram(['D', 'D', 'D'], [REPEAT], undefined, name)
        expect(repeated.main).toEqual([{ kind: 'repeat', times: 3, body: [{ kind: 'action', block: 'D' }] }])
    })

    test("with decomposition a repetition is never nested", () => {
        const input = words('D D D A D D D A D D D A')
        const program = optimizeProgram(input, [REPEAT, PROC], { decomposition: { maxProgramLength: 7 } }, name)
        expect(nests(program.main)).toBe(false)
        program.procedures.forEach(p => expect(nests(p.body)).toBe(false))
        expect(flatten(program)).toEqual(input)
    })
})
