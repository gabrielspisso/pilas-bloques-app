import { parseProgram } from "../../../../../components/creator/ai/parseProgram"
import { Program, Statement } from "../../../../../components/creator/solver/types"

const action = (block = "AgarrarTomate"): Statement => ({ kind: "action", block })
const program = (main: unknown[], procedures: unknown[] = []) => ({ main, procedures })
const errorsOf = (value: unknown, type: "Lita" | "Toto" = "Lita") => {
    const result = parseProgram(value, type)
    return "errors" in result ? result.errors : []
}
const nested = (levels: number): Statement => levels === 1 ? action() : { kind: "repeat", times: 2, body: [nested(levels - 1)] }

describe("parseProgram", () => {
    test("accepts the five kinds of statement", () => {
        const valid: Program = {
            main: [
                action("MoverA:ParaLaDerecha"),
                { kind: "call", name: "move" },
                { kind: "repeat", times: 100, body: [action()] },
                { kind: "if", sensor: "HayTomate", body: [action()] },
                { kind: "until", sensor: "BordeDerecho", body: [{ kind: "if", sensor: "HayObstaculoAbajo", body: [] }] }
            ],
            procedures: [{ name: "move", body: [action("MoverACasillaDerecha")] }]
        }

        expect(parseProgram(valid, "Lita")).toEqual({ program: valid })
    })

    test("keeps only the known fields", () => {
        const result = parseProgram({ main: [{ ...action(), extra: 1 }], procedures: [], other: 2 }, "Lita")

        expect(result).toEqual({ program: { main: [action()], procedures: [] } })
    })

    test.each([
        ["nothing", undefined],
        ["a list", []],
        ["no procedures", { main: [] }],
        ["a statement that is not an object", program([null])],
        ["an unknown kind", program([{ kind: "jump", body: [] }])],
        ["times 0", program([{ kind: "repeat", times: 0, body: [] }])],
        ["times 101", program([{ kind: "repeat", times: 101, body: [] }])],
        ["decimal times", program([{ kind: "repeat", times: 1.5, body: [] }])],
        ["a body that is not a list", program([{ kind: "repeat", times: 2, body: 3 }])],
        ["a call to a missing procedure", program([{ kind: "call", name: "move" }])],
        ["repeated procedure names", program([], [{ name: "a", body: [] }, { name: "a", body: [] }])],
        ["a procedure without name", program([], [{ name: " ", body: [] }])],
        ["more than 500 statements", program(Array(501).fill(action()))],
        ["more than 500 statements between main and procedures", program(Array(300).fill(action()), [{ name: "a", body: Array(201).fill(action()) }])],
        ["more than 8 levels", program([nested(9)])],
        ["a block of another character", program([action("ComerChurrasco")])],
        ["an unknown movement", program([action("MoverA:ParaAdentro")])],
        ["an inherited property as block", program([action("toString")])],
        ["a sensor of another character", program([{ kind: "if", sensor: "HayChurrasco", body: [] }])],
        ["an unknown sensor", program([{ kind: "until", sensor: "constructor", body: [] }])]
    ])("rejects %s", (_name, value) => {
        expect(errorsOf(value).length).toBeGreaterThan(0)
    })

    test("accepts exactly 500 statements and 8 levels", () => {
        expect(errorsOf(program(Array(500).fill(action())))).toEqual([])
        expect(errorsOf(program([nested(8)]))).toEqual([])
    })

    test("does not overflow on a very deep program", () => {
        expect(errorsOf(program([nested(5000)])).length).toBeGreaterThan(0)
    })

    test("rejects a character the simulator does not know", () => {
        expect(errorsOf(program([]), "Toto")).toEqual([expect.stringContaining("Toto")])
    })

    test("says where the problem is", () => {
        expect(errorsOf(program([action(), { kind: "repeat", times: 0, body: [] }]))).toEqual([expect.stringContaining("main[1]")])
    })
})
