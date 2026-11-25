import mulang from "mulang"
import { usesConditionalAlternative } from "../../../../../components/blockly/mulang/expectations"
import { commonPuzzle, everyIfDecides } from "../../../../../components/creator/solver/commonProgram"
import { compress } from "../../../../../components/creator/solver/optimize"
import { modelFor, runProgram } from "../../../../../components/creator/solver/sceneModel"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess, Statement } from "../../../../../components/creator/solver/types"
import { Assesments, SceneType, defaultChallenge } from "../../../../../components/serializedChallenge"
import { MOVES4, R, REPEAT } from "./helpers"
import { programToAst } from "./programToAst"

const solve = (type: SceneType, maps: string[][][], blocks: string[], assesments?: Assesments, index = 0) =>
    solveChallenge({ ...defaultChallenge('Duba'), toolbox: { blocks }, assesments, scene: { type, maps } }, index, n => `Parte ${n}`) as SolverSuccess

const ifs = (statements: Statement[]): Extract<Statement, { kind: 'if' }>[] =>
    statements.flatMap(s => [...(s.kind === 'if' ? [s] : []), ...('body' in s ? ifs(s.body) : [])])
const allIfs = ({ program }: SolverSuccess) => [program.main, ...program.procedures.map(p => p.body)].flatMap(ifs)

/** Runs the solution on every scenario: all solved, and every "If" true somewhere and false elsewhere. */
const checkHonest = (type: SceneType, maps: string[][][], result: SolverSuccess) => {
    const runs = maps.map(map => runProgram(modelFor(type)!, map, result.program))
    runs.forEach(run => expect(run.solved).toBe(true))
    expect(allIfs(result).length).toBeGreaterThan(0)
    allIfs(result).forEach(node => {
        const seen = runs.map(run => run.trace.filter(entry => entry.node === node).map(entry => entry.value))
        expect(seen.some((values, i) => values.includes(true) && seen.some((other, j) => j !== i && other.includes(false)))).toBe(true)
    })
    expect(everyIfDecides(runs)).toBe(true)
}

describe("compatibility of the scenarios", () => {
    const lita = modelFor('Lita')!
    test.each([
        ['size', [["A", "L"]], [["A", "L", "-"]]],
        ['start', [["A", "L"]], [["L", "A"]]],
        ['obstacleConflict', [["A", "O"]], [["A", "L"]]]
    ])("%s", (reason, first, second) => {
        expect(commonPuzzle(lita, [first, second], MOVES4)).toEqual({ kind: 'incompatible', reason })
    })
})

describe("one program for every scenario", () => {
    const maps = [[["A", "L", "-"]], [["A", "-", "L"]]]
    const toolbox = [...MOVES4, 'AgarrarLechuga', 'Si', 'HayLechuga']

    test("asks with a sensor where the scenarios differ", () => {
        const result = solve('Lita', maps, toolbox)
        expect(result.scenarios).toEqual([{ index: 0, solved: true }, { index: 1, solved: true }])
        expect(result.notes).toEqual([{ id: 'commonProgram', scenarios: 2 }])
        expect(allIfs(result).map(s => s.sensor)).toEqual(['HayLechuga', 'HayLechuga'])
        checkHonest('Lita', maps, result)
    })

    test("without 'Si' it solves one scenario and says what is missing", () => {
        const result = solve('Lita', maps, [...MOVES4, 'AgarrarLechuga', 'HayLechuga'])
        expect(result.notes).toEqual([{ id: 'commonNeedsBlocks', blocks: ['Si'] }])
        expect(result.scenarios).toEqual([{ index: 0, solved: true }, { index: 1, solved: false }])
        expect(allIfs(result)).toEqual([])
    })

    test("incompatible scenarios are explained", () => {
        const result = solve('Lita', [maps[0], [["A", "L"]]], toolbox, { conditionalAlternative: true })
        expect(result.notes).toEqual([{ id: 'scenariosIncompatible', reason: 'size' }])
        expect(result.warnings).toEqual([{ id: 'needsConditionalAlternative', reason: 'incompatibleScenarios' }])
    })

    test("equal scenarios leave nothing to decide", () => {
        const result = solve('Lita', [maps[0], maps[0]], toolbox, { conditionalAlternative: true })
        expect(allIfs(result)).toEqual([])
        expect(result.notes).toEqual([])
        expect(result.warnings).toEqual([{ id: 'needsConditionalAlternative', reason: 'nothingToDecide' }])
        expect(result.scenarios.every(s => s.solved)).toBe(true)
    })

    test("a single scenario has nothing to decide either", () => {
        const result = solve('Lita', [maps[0]], toolbox, { conditionalAlternative: true })
        expect(allIfs(result)).toEqual([])
        expect(result.warnings).toEqual([{ id: 'needsConditionalAlternative', reason: 'nothingToDecide' }])
    })

    test("the salad waits for the ingredients of every scenario", () => {
        const boards = [[["A", "E", "L", "-"]], [["A", "E", "-", "L"]]]
        const result = solve('Lita', boards, [...toolbox, 'PrepararEnsalada'])
        expect(result.scenarios.every(s => s.solved)).toBe(true)
        const executed = runProgram(modelFor('Lita')!, boards[1], result.program).executed
        expect(executed.indexOf('PrepararEnsalada')).toBeGreaterThan(executed.indexOf('AgarrarLechuga'))
        checkHonest('Lita', boards, result)
    })

    test("a salad bowl and a lettuce can swap places", () => {
        const boards = [[["A", "E", "L"]], [["A", "L", "E"]]]
        const result = solve('Lita', boards, [...toolbox, 'PrepararEnsalada', 'HayEnsaladera'])
        expect(result.scenarios.every(s => s.solved)).toBe(true)
        checkHonest('Lita', boards, result)
    })

    test("only what differs is conditional", () => {
        const boards = [[["A", "C", "K"]], [["A", "-", "K"]]]
        const result = solve('Yvoty', boards, [...MOVES4, 'DesbloquearCelular', 'AgarrarCargador', 'Si', 'TocandoCelular'])
        expect(result.program.main).toEqual([
            { kind: 'action', block: R },
            { kind: 'if', sensor: 'TocandoCelular', body: [{ kind: 'action', block: 'DesbloquearCelular' }] },
            { kind: 'action', block: R },
            { kind: 'action', block: 'AgarrarCargador' }
        ])
        checkHonest('Yvoty', boards, result)
    })

    test("meets the conditional alternative for Mulang", () => {
        const result = solve('Lita', maps, toolbox, { conditionalAlternative: true })
        expect(result.warnings).toEqual([])
        const passed = (mulang as any).astCode(programToAst(result.program)).customExpect(usesConditionalAlternative())
        expect(passed.map(([, ok]: [string, boolean]) => ok)).toEqual([true])
    })

    test("also looks for a 'Repeat until' that works on every scenario", () => {
        const boards = [[["A", "-", "-", "P"]], [["A", "-", "-", "-"]]]
        const result = solve('Duba', boards, [...MOVES4, 'ComerChurrasco', 'Si', 'HayChurrasco', 'Hasta', 'BordeDerecho'],
            { conditionalAlternative: true, conditionalRepetition: true })
        expect(result.program.main.map(s => s.kind)).toEqual(['until', 'if'])
        expect(result.program.main[0]).toMatchObject({ sensor: 'BordeDerecho' })
        expect(result.warnings).toEqual([])
        expect(result.notes).toEqual([{ id: 'commonProgram', scenarios: 2 }])
        checkHonest('Duba', boards, result)
    })

    test("with decomposition an 'If' is never inside a 'Repeat'", () => {
        const token = '#if:HayLechuga:AgarrarLechuga'
        const tokens = Array.from({ length: 4 }, () => [R, token]).flat()
        expect(compress(tokens, true).cost).toBe(5)
        expect(compress(tokens, false).statements.some(s => s.kind === 'repeat')).toBe(false)

        const boards = [[["A", "L", "-", "L", "-"]], [["A", "-", "L", "-", "L"]]]
        const result = solve('Lita', boards, [...toolbox, REPEAT, 'Procedimiento'],
            { decomposition: { maxProgramLength: 5 }, conditionalAlternative: true })
        expect(result.warnings).toEqual([])
        checkHonest('Lita', boards, result)
    })
})
