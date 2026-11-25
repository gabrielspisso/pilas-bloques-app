import { flatten } from "../../../../../components/creator/solver/optimize"
import { modelFor, simulateWith } from "../../../../../components/creator/solver/sceneModel"
import { descriptorToMap } from "./descriptorToMap"
import { officialSolutions } from "./officialSolutions"
import { xmlToProgram } from "./xmlToProgram"

describe("official solutions (validated on the real engine by Cypress) in the simulator", () => {
    test.each(officialSolutions.map(solution => [solution.id, solution] as const))("%i", (_, { type, descriptor, xml }) => {
        const map = descriptorToMap(descriptor)
        const tokens = flatten(xmlToProgram(xml))
        const model = modelFor(type)!

        expect(new Set(map.map(row => row.length)).size).toBe(1)
        expect(simulateWith(model, map, tokens)).toEqual({ solved: true })
        expect(simulateWith(model, map, tokens.slice(0, -1)).solved).toBe(false)
    })
})
