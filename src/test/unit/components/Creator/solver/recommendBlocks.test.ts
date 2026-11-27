import { recommendedMissingBlocks, usedBlocks } from "../../../../../components/creator/solver/recommendBlocks"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess } from "../../../../../components/creator/solver/types"
import { Assesments, SceneType, defaultChallenge } from "../../../../../components/serializedChallenge"
import { MOVES4, R } from "./helpers"

const name = (n: number) => `Parte ${n}`
const challenge = (type: SceneType, maps: string[][][], blocks: string[] = [], assesments?: Assesments) =>
    ({ ...defaultChallenge('Duba'), toolbox: { blocks }, assesments, scene: { type, maps } })
const recommend = (...args: Parameters<typeof challenge>) => recommendedMissingBlocks(challenge(...args), 0, name)

/** Adding what is recommended must leave a solvable challenge that works on every scenario. */
const afterAdding = (...[type, maps, blocks = [], assesments]: Parameters<typeof challenge>) => {
    const added = [...blocks, ...recommend(type, maps, blocks, assesments)]
    return solveChallenge(challenge(type, maps, added, assesments), 0, name) as SolverSuccess
}

describe("recommended blocks", () => {
    const line = [["A", "-", "-", "P"]]

    test("only what the solution uses", () => {
        expect(recommend('Duba', [line]).sort()).toEqual(['ComerChurrasco', R, 'Repetir'].sort())
        expect(afterAdding('Duba', [line])).toMatchObject({ kind: 'solved', blocks: 3 })
    })

    test("nothing when the toolbox already has them", () => {
        expect(recommend('Duba', [line], [R, 'ComerChurrasco', 'Repetir'])).toEqual([])
    })

    test("conditions and sensors for different scenarios", () => {
        const maps = [[["A", "L", "-"]], [["A", "-", "L"]]]
        expect(recommend('Lita', maps)).toEqual(expect.arrayContaining(['Si', 'HayLechuga', 'AgarrarLechuga', R]))
        expect(afterAdding('Lita', maps).scenarios.every(s => s.solved)).toBe(true)
    })

    test("procedures when decomposition asks for them", () => {
        const long = [["A", "P", "-", "P", "P", "-", "-", "P", "-", "P"]]
        const assesments = { decomposition: { maxProgramLength: 4 } }
        expect(recommend('Duba', [long], [], assesments)).toContain('Procedimiento')
        expect(afterAdding('Duba', [long], [], assesments).warnings).toEqual([])
    })

    test("keeps 'Move to' when the teacher chose it", () => {
        expect(recommend('Duba', [line], ['MoverA', 'ParaLaDerecha'])).not.toContain(R)
    })

    test("keeps charging cellphones when the teacher chose it", () => {
        const missing = recommend('Yvoty', [[["A", "C", "K"]]], [...MOVES4, 'CargarCelular'])
        expect(missing).toContain('AgarrarCargador')
        expect(missing).not.toContain('DesbloquearCelular')
    })

    test("nothing when it cannot be solved", () => {
        expect(recommend('Chuy', [[["A", "P"]]])).toEqual([])
        expect(recommend('Duba', [[["A", "O", "P"]]])).toEqual([])
    })

    test("lists the blocks of a program", () => {
        expect(usedBlocks({
            main: [{ kind: 'until', sensor: 'BordeDerecho', body: [{ kind: 'action', block: 'MoverA:ParaLaDerecha' }] }, { kind: 'call', name: 'P' }],
            procedures: [{ name: 'P', body: [{ kind: 'if', sensor: 'HayLechuga', body: [{ kind: 'action', block: 'AgarrarLechuga' }] }] }]
        })).toEqual(['Hasta', 'BordeDerecho', 'MoverA', 'ParaLaDerecha', 'Si', 'HayLechuga', 'AgarrarLechuga', 'Procedimiento'])
    })
})
