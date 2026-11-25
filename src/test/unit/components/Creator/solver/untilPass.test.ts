import mulang from "mulang"
import { usesConditionalRepetition } from "../../../../../components/blockly/mulang/expectations"
import { modelFor, runProgram } from "../../../../../components/creator/solver/sceneModel"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess, Statement } from "../../../../../components/creator/solver/types"
import { Assesments, SceneType, defaultChallenge } from "../../../../../components/serializedChallenge"
import { MOVES4, R, REPEAT } from "./helpers"
import { programToAst } from "./programToAst"

const solve = (maps: string[][][], blocks: string[], assesments: Assesments = { conditionalRepetition: true }, type: SceneType = 'Duba') =>
    solveChallenge({ ...defaultChallenge('Duba'), toolbox: { blocks }, assesments, scene: { type, maps } }, 0, n => `Parte ${n}`) as SolverSuccess
const action = (block: string): Statement => ({ kind: 'action', block })
const untilRight = (sensor: string): Statement => ({ kind: 'until', sensor, body: [action(R)] })

describe("conditional repetition", () => {
    const line = [["A", "-", "-", "P"]]
    const toolbox = [...MOVES4, 'ComerChurrasco', 'Hasta']

    test.each(['BordeDerecho', 'HayChurrasco'])("stops with %s", sensor => {
        const result = solve([line], [...toolbox, sensor])
        expect(result.program.main).toEqual([untilRight(sensor), action('ComerChurrasco')])
        expect(runProgram(modelFor('Duba')!, line, result.program)).toMatchObject({ solved: true, loops: [{ times: 3 }] })
        expect(result.notes).toEqual([{ id: 'untilWithOneScenario' }])
        expect(result.warnings).toEqual([])
        const passed = (mulang as any).astCode(programToAst(result.program)).customExpect(usesConditionalRepetition())
        expect(passed.map(([, ok]: [string, boolean]) => ok)).toEqual([true])
    })

    test("converts a Repeat too", () => {
        const result = solve([line], [...toolbox, 'BordeDerecho', REPEAT])
        expect(result.program.main).toEqual([untilRight('BordeDerecho'), action('ComerChurrasco')])
    })

    test("keeps the repetition when no condition stops at the right place", () => {
        const result = solve([[["A", "-", "P", "-"]]], [...toolbox, 'BordeDerecho'])
        expect(result.program.main.some(s => s.kind === 'until')).toBe(false)
        expect(result.warnings).toEqual([{ id: 'needsConditionalRepetition', reason: 'noLandmark' }])
        expect(result.notes).toEqual([])
    })

    test("says which blocks are missing", () => {
        expect(solve([line], [...MOVES4, 'ComerChurrasco', 'BordeDerecho']).warnings)
            .toEqual([{ id: 'needsConditionalRepetition', reason: 'missingBlocks', blocks: ['Hasta'] }])
        expect(solve([line], toolbox).warnings)
            .toEqual([{ id: 'needsConditionalRepetition', reason: 'missingBlocks', blocks: ['BordeDerecho', 'HayChurrasco'] }])
    })

    test("never appears when the assessment is off", () => {
        const result = solve([line], [...toolbox, 'BordeDerecho'], {})
        expect(result.program.main.some(s => s.kind === 'until')).toBe(false)
    })

    // Known limit of the rule: only stretches whose body ends in a move are converted.
    test("a body that ends in an action is not converted", () => {
        const result = solve([[["A", "U", "U", "U"]]], [...MOVES4, 'PatearPulpito', REPEAT, 'Hasta', 'BordeDerecho'], { conditionalRepetition: true }, 'Chuy')
        expect(result.warnings).toEqual([{ id: 'needsConditionalRepetition', reason: 'noLandmark' }])
    })
})
