import { flatten } from "../../../../../components/creator/solver/optimize"
import { modelFor, runProgram, simulateWith } from "../../../../../components/creator/solver/sceneModel"
import { descriptorToMap } from "./descriptorToMap"
import { officialSolutions } from "./officialSolutions"
import { xmlToProgram } from "./xmlToProgram"

describe("official solutions (validated on the real engine by Cypress) in the simulator", () => {
    test.each([0, 1, 2, 3, 4, 5, 6, 7])("1016, variant %i of the telescopes (uses 'Si')", variant => {
        const { type, descriptor, xml } = officialSolutions.find(solution => solution.id === 1016)!
        // "[A,T?,T?,T?]": each "T?" is a telescope or nothing. The final position of the challenge is not modelled.
        let optional = 0
        const map = descriptorToMap(descriptor).map(row => row.map(c => c === 'T?' ? (variant & (1 << optional++) ? 'T' : '-') : c))
        expect(optional).toBe(3)

        expect(runProgram(modelFor(type)!, map, xmlToProgram(xml))).toMatchObject({ solved: true })
    })

    test.each(officialSolutions.filter(solution => solution.id !== 1016).map(solution => [solution.id, solution] as const))("%i", (_, { type, descriptor, xml }) => {
        const map = descriptorToMap(descriptor)
        const tokens = flatten(xmlToProgram(xml))
        const model = modelFor(type)!

        expect(new Set(map.map(row => row.length)).size).toBe(1)
        expect(simulateWith(model, map, tokens)).toEqual({ solved: true })
        expect(simulateWith(model, map, tokens.slice(0, -1)).solved).toBe(false)
    })
})
