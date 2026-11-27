import { applyChanges, describeChallenge, recommendSolution, testProgram, validateChanges } from "../../../../../components/creator/ai/challengeTools"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess } from "../../../../../components/creator/solver/types"
import { xmlBloqueEmpezarAEjecutar } from "../../../../../components/blockly/blockly"
import { defaultChallenge, isValidChallenge } from "../../../../../components/serializedChallenge"
import { LITA_MAP, LITA_TOOLBOX, litaChallenge, procedureName } from "./fixtures"

const challenge = litaChallenge()
const solved = solveChallenge(challenge, 0, procedureName) as SolverSuccess
const row = (...cells: string[]) => [cells]
const move = { main: [{ kind: "action", block: "MoverACasillaDerecha" }], procedures: [] }

describe("testProgram", () => {
    test("runs the program of the solver", () => {
        expect(testProgram(challenge, { program: solved.program })).toEqual({
            scenarios: [{ index: 0, solved: true }], blocks: solved.blocks, warnings: [], missingBlocks: []
        })
    })

    test("says why a program does not solve", () => {
        const program = { ...solved.program, main: solved.program.main.slice(0, -1) }

        const result = testProgram(challenge, { program }) as any

        expect(result.scenarios).toEqual([{ index: 0, solved: false, reason: "notSolved", step: expect.any(Number) }])
    })

    test("reports the blocks that are not in the toolbox", () => {
        const toolbox = LITA_TOOLBOX.filter(block => block !== "PrepararEnsalada")

        const result = testProgram(challenge, { program: solved.program, toolbox }) as any

        expect(result.missingBlocks).toEqual(["PrepararEnsalada"])
    })

    test("checks the evaluations", () => {
        const result = testProgram(challenge, { program: move, assesments: { conditionalAlternative: true } }) as any

        expect(result.warnings.map((warning: any) => warning.id)).toEqual(["needsConditionalAlternative"])
    })

    test("runs every scenario, including other ones than the challenge's", () => {
        const maps = [row("A", "-"), row("A", "O")]

        const result = testProgram(challenge, { program: move, maps }) as any

        // With nothing to pick up, Lita wins just by running.
        expect(result.scenarios).toEqual([{ index: 0, solved: true }, { index: 1, solved: false, reason: "obstacle", step: 0 }])
    })

    test("reports an unreadable scenario instead of failing", () => {
        const result = testProgram(litaChallenge({ scene: { type: "Lita", maps: [row("-", "-")] } }), { program: move }) as any

        expect(result.scenarios).toEqual([{ index: 0, solved: false, reason: "invalidMap", step: -1 }])
    })

    test.each([
        ["an invalid program", { program: { main: [{ kind: "jump" }], procedures: [] } }],
        ["invalid maps", { program: move, maps: [row("A", "Z")] }],
        ["an invalid toolbox", { program: move, toolbox: "Repetir" }],
        ["invalid evaluations", { program: move, assesments: { decomposition: {} } }]
    ])("returns the errors of %s", (_name, params) => {
        expect((testProgram(challenge, params) as any).errors.length).toBeGreaterThan(0)
    })
})

describe("recommendSolution", () => {
    test("returns the result of the solver without the XML", () => {
        const { xml, ...expected } = solved

        expect(recommendSolution(challenge, {}, 0, procedureName)).toEqual(expected)
    })

    test("accepts another toolbox", () => {
        expect(recommendSolution(challenge, { toolbox: [] }, 0, procedureName)).toMatchObject({ kind: "missingBlocks" })
    })

    test("uses the scenario asked for, or the one being edited", () => {
        const two = litaChallenge({ scene: { type: "Lita", maps: [LITA_MAP, row("A", "L")] } })

        expect(recommendSolution(two, {}, 1, procedureName)).toMatchObject({ scenarioIndex: 1 })
        expect(recommendSolution(two, { scenario: 0 }, 1, procedureName)).toMatchObject({ scenarioIndex: 0 })
        expect((recommendSolution(two, { scenario: 2 }, 0, procedureName) as any).errors.length).toBe(1)
    })
})

describe("validateChanges", () => {
    const errors = (changes: unknown) => validateChanges(challenge, changes)

    test("accepts a whole new level", () => {
        const changes = {
            title: "t".repeat(200), description: "d".repeat(2000), clue: "c".repeat(2000), maps: [LITA_MAP, LITA_MAP],
            toolbox: LITA_TOOLBOX, assesments: { simpleRepetition: true, decomposition: { maxProgramLength: 7 } },
            previewProgram: solved.program, initialProgram: move
        }

        expect(errors(changes)).toEqual([])
    })

    test("accepts removing the starting blocks", () => {
        expect(errors({ initialProgram: null })).toEqual([])
    })

    const column = (rows: number) => [["A"], ...Array(rows - 1).fill(["-"])]

    test("accepts the biggest board of the creator", () => {
        const biggest = [["A", ...Array(7).fill("-")], ...Array(9).fill(Array(8).fill("-"))]

        expect(errors({ maps: [biggest] })).toEqual([])
    })

    test.each<[string, unknown]>([
        ["something that is not an object", "title"],
        ["no change at all", {}],
        ["an unknown field", { sharedId: "x" }],
        ["another character", { scene: { type: "Duba" } }],
        ["an unknown letter", { maps: [row("A", "Z")] }],
        ["a letter of another character", { maps: [row("A", "P")] }],
        ["the missing cell of the official maps", { maps: [row("A", "_")] }],
        ["two actors", { maps: [row("A", "A")] }],
        ["two actors in one cell", { maps: [row("A&A", "-")] }],
        ["no actor", { maps: [row("-", "-")] }],
        ["no maps", { maps: [] }],
        ["an empty map", { maps: [[]] }],
        ["an empty row", { maps: [[[]]] }],
        ["rows of different length", { maps: [[["A", "-"], ["-"]]] }],
        ["too many rows", { maps: [column(11)] }],
        ["too many columns", { maps: [row("A", ...Array(8).fill("-"))] }],
        ["maps that are not text", { maps: [[[1]]] }],
        ["a block the creator does not offer", { toolbox: ["ComerChurrasco"] }],
        ["a block that only official challenges use", { toolbox: ["DibujarLado"] }],
        ["a repeated block", { toolbox: ["Repetir", "Repetir"] }],
        ["a preview program with blocks out of the toolbox", { previewProgram: solved.program, toolbox: ["Repetir"] }],
        ["a starting program with blocks out of the toolbox", { initialProgram: { main: [{ kind: "if", sensor: "HayTomate", body: [] }], procedures: [] } }],
        ["a procedure without the procedures block", { previewProgram: { main: [], procedures: [{ name: "a", body: [] }] } }],
        ["an invalid program", { previewProgram: { main: [{ kind: "jump" }], procedures: [] } }],
        ["a null preview program", { previewProgram: null }],
        ["a long title", { title: "t".repeat(201) }],
        ["a long description", { description: "d".repeat(2001) }],
        ["a long clue", { clue: "c".repeat(2001) }],
        ["a title that is not text", { title: 3 }],
        ["an unknown evaluation", { assesments: { speed: true } }],
        ["an evaluation of the wrong type", { assesments: { simpleRepetition: "yes" } }],
        ["a program length out of range", { assesments: { decomposition: { maxProgramLength: 1000 } } }]
    ])("rejects %s", (_name, changes) => {
        expect(errors(changes).length).toBeGreaterThan(0)
    })

    test("keeps accepting a block the challenge already had", () => {
        const imported = litaChallenge({ toolbox: { blocks: ["DibujarLado"] } })

        expect(validateChanges(imported, { toolbox: ["DibujarLado", "Repetir"] })).toEqual([])
    })

    test("checks the programs against the new toolbox", () => {
        const empty = litaChallenge({ toolbox: { blocks: [] } })

        expect(validateChanges(empty, { toolbox: ["MoverACasillaDerecha"], previewProgram: move })).toEqual([])
    })
})

describe("applyChanges", () => {
    test("changes only what was proposed", () => {
        const shared = litaChallenge({ sharedId: "abc", statement: { description: "old", clue: "keep" } })

        const result = applyChanges(shared, { description: "new" })

        expect(result).toEqual({ ...shared, statement: { description: "new", clue: "keep" } })
        expect(shared.statement.description).toBe("old")
    })

    test("categorizes a toolbox with procedures and writes the starting blocks", () => {
        const result = applyChanges(challenge, { toolbox: ["Procedimiento"], initialProgram: { main: [], procedures: [] } })

        expect(result.toolbox).toEqual({ blocks: ["Procedimiento"], categorized: true })
        expect(result.predefinedSolution).toContain("<xml")
        expect(isValidChallenge(result)).toBe(true)
    })

    test("removes the starting blocks", () => {
        const result = applyChanges(litaChallenge({ predefinedSolution: xmlBloqueEmpezarAEjecutar }), { initialProgram: null })

        expect("predefinedSolution" in result).toBe(false)
    })
})

describe("describeChallenge", () => {
    const describe_ = () => describeChallenge(litaChallenge({ predefinedSolution: "<xml>start</xml>", statement: { description: "D", clue: "C" } }),
        { scenario: 0, previewXml: "<xml>preview</xml>", blockName: id => `name of ${id}` })

    test("describes the draft", () => {
        expect(describe_()).toMatchObject({
            character: "Lita", title: "Salad", description: "D", clue: "C", maps: [LITA_MAP], currentScenario: 0,
            toolbox: LITA_TOOLBOX, assesments: {}, initialBlocksXml: "<xml>start</xml>", previewBlocksXml: "<xml>preview</xml>",
            supported: true
        })
    })

    test("explains the blocks, letters and victory of the character", () => {
        const { catalog } = describe_()

        expect(catalog.blocks).toContainEqual({ id: "AgarrarTomate", name: "name of AgarrarTomate", category: "primitives", actsOn: "T" })
        expect(catalog.blocks).toContainEqual({ id: "HayTomate", name: "name of HayTomate", category: "sensors", detects: "T" })
        expect(catalog.blocks.map(block => block.id)).not.toContain("ComerChurrasco")
        expect(Object.keys(catalog.mapLetters)).toEqual(expect.arrayContaining(["A", "O", "-", "L", "T", "E", "A&X"]))
        expect(catalog.movementTokens).toContain("MoverA:ParaLaDerecha")
        expect(catalog.victory).toMatch(/salad/i)
        expect(catalog.limits).toMatchObject({ maxRows: 10, maxColumns: 8, titleLength: 200, textLength: 2000 })
    })

    test("warns that Chuy's ping pong can't be solved with the creator's blocks", () => {
        const { catalog } = describeChallenge(defaultChallenge("Chuy"), { scenario: 0, blockName: id => id })

        expect(catalog.victory).toMatch(/ping pong/i)
        expect(catalog.victory).toMatch(/cannot be solved/i)
        expect(catalog.blocks.map(block => block.id)).not.toContain("RebotarPingPong")
    })

    test("says when the simulator does not know the character", () => {
        expect(describeChallenge(defaultChallenge("Toto"), { scenario: 0, blockName: id => id }).supported).toBe(false)
    })
})
