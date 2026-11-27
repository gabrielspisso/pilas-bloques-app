import { SceneType, defaultChallenge } from "../../../../../components/serializedChallenge"
import { modelFor, simulateWith } from "../../../../../components/creator/solver/sceneModel"
import { flatten } from "../../../../../components/creator/solver/optimize"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess } from "../../../../../components/creator/solver/types"
import { L, MOVES4, R, cell } from "./helpers"

const type: SceneType = 'Yvoty'
const run = (map: string[][], actions: string[]) => simulateWith(modelFor(type)!, map, actions)
const solve = (map: string[][], blocks: string[]) =>
    solveChallenge({ ...defaultChallenge(type), toolbox: { blocks }, scene: { type, maps: [map] } }, 0, n => `Parte ${n}`)

describe("Yvoty", () => {
    const insects = [["A", "L", "M"]]
    const phone = [["A", "C", "K"]]

    test("fireflies and butterflies", () => {
        expect(run(insects, [R, 'DespertarLuciernaga', R, 'FotografiarMariposa'])).toEqual({ solved: true })
        expect(run(insects, [R, 'DespertarLuciernaga', 'DespertarLuciernaga'])).toEqual({ solved: false, reason: 'alreadyDone', step: 2 })
        expect(run(insects, ['DespertarLuciernaga'])).toEqual({ solved: false, reason: 'nothingHere', step: 0 })
        expect(run(insects, [R, R, 'FotografiarMariposa', 'FotografiarMariposa'])).toEqual({ solved: false, reason: 'nothingHere', step: 3 })
        expect(run(insects, [R, 'DespertarLuciernaga'])).toEqual({ solved: false, reason: 'notSolved', step: 2 })
    })

    test("cellphones and chargers", () => {
        // The charger does not count once no cellphone is left.
        expect(run(phone, [R, 'DesbloquearCelular'])).toEqual({ solved: true })
        expect(run(phone, [R, 'CargarCelular'])).toEqual({ solved: false, reason: 'chargersLeft', step: 1 })
        expect(run(phone, [R, R, 'AgarrarCargador', L, 'CargarCelular'])).toEqual({ solved: true })
        expect(run(phone, [R, R, 'AgarrarCargador', L, 'CargarCelular', 'CargarCelular'])).toEqual({ solved: false, reason: 'alreadyDone', step: 5 })
        expect(run(phone, [R, R, 'AgarrarCargador'])).toEqual({ solved: false, reason: 'notSolved', step: 3 })
        expect(run(phone, ['AgarrarCargador'])).toEqual({ solved: false, reason: 'nothingHere', step: 0 })
        expect(run(phone, ['DesbloquearCelular'])).toEqual({ solved: false, reason: 'nothingHere', step: 0 })
    })

    const solved = (blocks: string[]) => {
        const result = solve(phone, [...MOVES4, ...blocks]) as SolverSuccess
        expect(result.kind).toBe('solved')
        return { notes: result.notes, tokens: flatten(result.program) }
    }

    test("unlocks the cellphone and picks the charger when it can", () => {
        expect(solved(['DesbloquearCelular', 'AgarrarCargador']))
            .toEqual({ notes: [], tokens: [R, 'DesbloquearCelular', R, 'AgarrarCargador'] })
        expect(solved(['DesbloquearCelular']))
            .toEqual({ notes: [{ id: 'chargerNotRequired', cells: [cell(0, 2)] }], tokens: [R, 'DesbloquearCelular'] })
    })

    test("charging needs every charger first", () => {
        const { tokens } = solved(['CargarCelular', 'AgarrarCargador'])
        expect(tokens).toEqual([R, R, 'AgarrarCargador', L, 'CargarCelular'])
    })

    test("missing blocks", () => {
        expect(solve(phone, [...MOVES4, 'CargarCelular'])).toEqual({ kind: 'missingBlocks', blocks: ['AgarrarCargador'] })
        expect(solve(phone, MOVES4)).toEqual({ kind: 'missingBlocks', blocks: ['DesbloquearCelular'] })
    })

    test("chargers without cellphones are optional", () => {
        expect(solve([["A", "K"]], MOVES4)).toMatchObject({ kind: 'solved', notes: [{ id: 'chargerNotRequired', cells: [cell(0, 1)] }] })
        expect(solve([["A", "K"]], [...MOVES4, 'AgarrarCargador'])).toMatchObject({ kind: 'solved', notes: [], rawSteps: 2 })
    })
})
