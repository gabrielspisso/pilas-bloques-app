import { modelFor, runProgram } from "../../../../../components/creator/solver/sceneModel"
import { SceneType } from "../../../../../components/serializedChallenge"
import { Statement } from "../../../../../components/creator/solver/types"
import { D, R } from "./helpers"

const action = (block: string): Statement => ({ kind: 'action', block })
const when = (sensor: string, ...body: Statement[]): Statement => ({ kind: 'if', sensor, body })
const until = (sensor: string, ...body: Statement[]): Statement => ({ kind: 'until', sensor, body })
const run = (type: SceneType, map: string[][], ...main: Statement[]) => runProgram(modelFor(type)!, map, { main, procedures: [] })

describe("runProgram", () => {
    test("an 'if' decides with its sensor", () => {
        const result = run('Lita', [["A", "L", "-", "L"]],
            { kind: 'repeat', times: 3, body: [action(R), when('HayLechuga', action('AgarrarLechuga'))] })
        expect(result.solved).toBe(true)
        expect(result.trace.map(({ value }) => value)).toEqual([true, false, true])
        expect(result.executed).toEqual([R, 'AgarrarLechuga', R, R, 'AgarrarLechuga'])
    })

    test("'until' repeats until the sensor is true", () => {
        const result = run('Duba', [["A", "-", "-"]], until('BordeDerecho', action(R)))
        expect(result).toMatchObject({ solved: true, position: { row: 0, column: 2 }, loops: [{ times: 2 }] })
    })

    test("borders look at the grid, obstacle sensors fail without a cell to look at", () => {
        expect(run('Duba', [["A", "_"]], when('BordeDerecho', action(D)))).toMatchObject({ trace: [{ value: false }] })
        expect(run('Duba', [["A", "-"]], until('HayObstaculoDerecha', action(R)))).toMatchObject({ solved: false, reason: 'sensorError', step: 1 })
        expect(run('Duba', [["A", "O"]], when('HayObstaculoDerecha'))).toMatchObject({ trace: [{ value: true }] })
    })

    test("a sensor over an object that is flying away is not reliable", () => {
        const observe = action('ObservarEstrella')
        expect(run('Manic', [["A&E", "-"]], observe, when('TocandoEstrellaManic', observe)))
            .toMatchObject({ solved: false, reason: 'indeterminateSensor', step: 1 })
    })

    test("a repaired telescope is still there", () => {
        expect(run('Manic', [["A&T"]], action('RepararTelescopio'), when('TocandoTelescopio')))
            .toMatchObject({ solved: true, trace: [{ value: true }] })
    })

    test("endless programs and unknown names", () => {
        expect(run('Duba', [["A", "-"]], until('BordeDerecho'))).toMatchObject({ solved: false, reason: 'tooManySteps' })
        expect(runProgram(modelFor('Duba')!, [["A"]], { main: [{ kind: 'call', name: 'P' }], procedures: [{ name: 'P', body: [{ kind: 'call', name: 'P' }] }] }, 100))
            .toMatchObject({ solved: false, reason: 'tooManySteps' })
        expect(run('Duba', [["A"]], when('HayLechuga'))).toMatchObject({ solved: false, reason: 'unknownSensor' })
        expect(run('Duba', [["A"]], { kind: 'call', name: 'P' })).toMatchObject({ solved: false, reason: 'unknownBlock' })
    })
})
