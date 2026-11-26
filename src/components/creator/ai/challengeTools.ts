import { availableBlocksFor } from "../../blockly/blocks"
import { Assesments, SceneMap, SceneType, SerializedChallenge, isValidChallenge, sceneIsValid } from "../../serializedChallenge"
import { MAX_PROGRAM_LENGTH, MIN_PROGRAM_LENGTH } from "../assessments"
import { GRID_LIMITS, hasActor } from "../Editor/SceneEdition/mapUtils"
import { checkAssessments } from "../solver/assessmentCheck"
import { countBlocks } from "../solver/optimize"
import { programToXml } from "../solver/programXml"
import { usedBlocks } from "../solver/recommendBlocks"
import { modelFor, runProgram } from "../solver/sceneModel"
import { solveChallenge } from "../solver/solveChallenge"
import { Program } from "../solver/types"
import { MAX_TEXT_LENGTH, MAX_TITLE_LENGTH, catalogFor } from "./catalog"
import { parseProgram } from "./parseProgram"

// Pure functions behind the tools of the assistant. Everything they receive besides the draft comes
// from outside the app, so it is validated here even if the MCP server already checked its shape.

export type Changes = {
    title?: string,
    description?: string,
    clue?: string,
    maps?: SceneMap[],
    toolbox?: string[],
    assesments?: Assesments,
    /** loaded into the live preview, never saved */
    previewProgram?: Program,
    /** the blocks the student starts with; null removes them */
    initialProgram?: Program | null
}

const CHANGE_KEYS: (keyof Changes)[] = ['title', 'description', 'clue', 'maps', 'toolbox', 'assesments', 'previewProgram', 'initialProgram']

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const mapErrors = (maps: unknown, type: SceneType): string[] => {
    if (!Array.isArray(maps) || !maps.length) return ['"maps" is a list with at least one scenario']

    return maps.flatMap((map, index) => {
        const name = `Scenario ${index}`
        if (!Array.isArray(map) || !map.length || !map.every(row => Array.isArray(row) && row.length))
            return [`${name}: it is a list of non empty rows`]
        const rows = map as unknown[][]
        const columns = rows[0].length
        if (rows.some(row => row.length !== columns)) return [`${name}: every row needs the same number of cells`]
        if (rows.length > GRID_LIMITS.maxRows || columns > GRID_LIMITS.maxColumns)
            return [`${name}: a board has at most ${GRID_LIMITS.maxRows} rows and ${GRID_LIMITS.maxColumns} columns`]

        const cells = rows.flat()
        const invalid = cells.filter(cell => typeof cell !== 'string' || !sceneIsValid({ type, maps: [[[cell]]] }))
        if (invalid.length) return [`${name}: invalid cells for ${type}: ${Array.from(new Set(invalid)).join(', ')}`]
        const actors = (cells as string[]).filter(hasActor).length
        return actors === 1 ? [] : [`${name}: it needs exactly one character (A), it has ${actors}`]
    })
}

/** Blocks the creator offers, plus the ones the challenge already has (e.g. an imported challenge). */
const toolboxErrors = (toolbox: unknown, challenge: SerializedChallenge): string[] => {
    if (!Array.isArray(toolbox) || !toolbox.every(block => typeof block === 'string')) return ['"toolbox" is a list of block ids']

    const offered = [...availableBlocksFor(challenge.scene.type).map(({ id }) => id), ...challenge.toolbox.blocks]
    const unknown = toolbox.filter(block => !offered.includes(block))
    if (unknown.length) return [`The creator does not offer these blocks for ${challenge.scene.type}: ${unknown.join(', ')}`]
    return new Set(toolbox).size === toolbox.length ? [] : ['"toolbox" has repeated blocks']
}

const BOOLEAN_ASSESSMENTS = ['itWorks', 'simpleRepetition', 'conditionalRepetition', 'conditionalAlternative']

const assessmentErrors = (assesments: unknown): string[] => {
    if (!isRecord(assesments)) return ['"assesments" is an object']

    return Object.entries(assesments).flatMap(([key, value]) => {
        if (BOOLEAN_ASSESSMENTS.includes(key)) return typeof value === 'boolean' ? [] : [`"assesments.${key}" is true or false`]
        if (key !== 'decomposition') return [`Unknown evaluation "${key}"`]
        const length = isRecord(value) ? value.maxProgramLength : undefined
        return typeof length === 'number' && Number.isInteger(length) && length >= MIN_PROGRAM_LENGTH && length <= MAX_PROGRAM_LENGTH ?
            [] : [`"assesments.decomposition.maxProgramLength" is a whole number from ${MIN_PROGRAM_LENGTH} to ${MAX_PROGRAM_LENGTH}`]
    })
}

/** Errors of the fields that testing and recommending can override. */
const overrideErrors = (challenge: SerializedChallenge, { maps, toolbox, assesments }: Record<string, unknown>): string[] => [
    ...(maps === undefined ? [] : mapErrors(maps, challenge.scene.type)),
    ...(toolbox === undefined ? [] : toolboxErrors(toolbox, challenge)),
    ...(assesments === undefined ? [] : assessmentErrors(assesments))
]

const withOverrides = (challenge: SerializedChallenge, { maps, toolbox, assesments }: Record<string, unknown>): SerializedChallenge => ({
    ...challenge,
    ...(maps === undefined ? {} : { scene: { ...challenge.scene, maps: maps as SceneMap[] } }),
    ...(toolbox === undefined ? {} : { toolbox: { ...challenge.toolbox, blocks: toolbox as string[] } }),
    ...(assesments === undefined ? {} : { assesments: assesments as Assesments })
})

export const testProgram = (challenge: SerializedChallenge, params: unknown) => {
    const request = isRecord(params) ? params : {}
    const errors = overrideErrors(challenge, request)
    const parsed = parseProgram(request.program, challenge.scene.type)
    if ('errors' in parsed) errors.push(...parsed.errors)
    if (errors.length || 'errors' in parsed) return { errors }

    const tested = withOverrides(challenge, request)
    const { program } = parsed
    const model = modelFor(tested.scene.type)!
    const toolbox = tested.toolbox.blocks

    return {
        scenarios: tested.scene.maps.map((map, index) => {
            try {
                const run = runProgram(model, map, program)
                return run.solved ? { index, solved: true } : { index, solved: false, reason: run.reason, step: run.step }
            } catch {
                // The draft itself can have a scenario without a character.
                return { index, solved: false, reason: 'invalidMap', step: -1 }
            }
        }),
        blocks: countBlocks(program),
        warnings: checkAssessments(program, toolbox, tested.assesments),
        missingBlocks: usedBlocks(program).filter(block => !toolbox.includes(block))
    }
}

export const recommendSolution = (challenge: SerializedChallenge, params: unknown, currentScenario: number, procedureName: (n: number) => string) => {
    const request = isRecord(params) ? params : {}
    const errors = overrideErrors(challenge, request)
    if (errors.length) return { errors }

    const tried = withOverrides(challenge, request)
    const scenario = request.scenario ?? Math.min(currentScenario, tried.scene.maps.length - 1)
    if (typeof scenario !== 'number' || !Number.isInteger(scenario) || scenario < 0 || scenario >= tried.scene.maps.length)
        return { errors: [`"scenario" goes from 0 to ${tried.scene.maps.length - 1}`] }

    const result = solveChallenge(tried, scenario, procedureName)
    if (result.kind !== 'solved') return result
    const { xml, ...solution } = result
    return solution
}

/** The challenge with the proposed changes. `changes` must be valid. */
export const applyChanges = (challenge: SerializedChallenge, changes: Changes): SerializedChallenge => {
    const { title, description, clue, toolbox, initialProgram } = changes
    const result: SerializedChallenge = {
        ...withOverrides(challenge, { maps: changes.maps, assesments: changes.assesments }),
        statement: { ...challenge.statement }
    }
    if (title !== undefined) result.title = title
    if (description !== undefined) result.statement.description = description
    if (clue !== undefined) result.statement.clue = clue
    // Procedures need the categorized toolbox, as in the toolbox editor.
    if (toolbox !== undefined) result.toolbox = { ...challenge.toolbox, blocks: toolbox, ...(toolbox.includes('Procedimiento') ? { categorized: true } : {}) }
    if (initialProgram) result.predefinedSolution = programToXml(initialProgram)
    if (initialProgram === null) delete result.predefinedSolution
    return result
}

const textErrors = (changes: Record<string, unknown>): string[] =>
    ([['title', MAX_TITLE_LENGTH], ['description', MAX_TEXT_LENGTH], ['clue', MAX_TEXT_LENGTH]] as const).flatMap(([key, max]) => {
        const text = changes[key]
        if (text === undefined) return []
        return typeof text === 'string' && text.length <= max ? [] : [`"${key}" is a text of up to ${max} characters`]
    })

/** Why the changes can't be proposed; empty when they can. */
export const validateChanges = (challenge: SerializedChallenge, changes: unknown): string[] => {
    if (!isRecord(changes)) return ['"changes" is an object']
    const unknown = Object.keys(changes).filter(key => !(CHANGE_KEYS as string[]).includes(key))
    if (unknown.length) return [`These fields can't be changed: ${unknown.join(', ')}`]
    if (!Object.values(changes).some(value => value !== undefined)) return ['There is nothing to change']

    const errors = [...textErrors(changes), ...overrideErrors(challenge, changes)]
    if (errors.length) return errors

    const toolbox = (changes.toolbox as string[] | undefined) ?? challenge.toolbox.blocks
    const programs: Changes = {}
    for (const key of ['previewProgram', 'initialProgram'] as const) {
        const value = changes[key]
        if (value === undefined || (key === 'initialProgram' && value === null)) continue
        const parsed = parseProgram(value, challenge.scene.type)
        if ('errors' in parsed) {
            errors.push(...parsed.errors.map(error => `${key}: ${error}`))
            continue
        }
        const missing = usedBlocks(parsed.program).filter(block => !toolbox.includes(block))
        if (missing.length) errors.push(`${key} uses blocks that are not in the toolbox: ${missing.join(', ')}`)
        programs[key] = parsed.program
    }
    if (errors.length) return errors

    return isValidChallenge(applyChanges(challenge, { ...changes as Changes, ...programs })) ? [] : ['The resulting challenge is not valid']
}

type DescribeOptions = { scenario: number, previewXml?: string, blockName: (id: string) => string }

export const describeChallenge = (challenge: SerializedChallenge, { scenario, previewXml, blockName }: DescribeOptions) => ({
    character: challenge.scene.type,
    /** false: the simulator (test_program, get_recommended_solution) does not know the character */
    supported: !!modelFor(challenge.scene.type),
    title: challenge.title,
    description: challenge.statement.description,
    clue: challenge.statement.clue,
    maps: challenge.scene.maps,
    currentScenario: scenario,
    toolbox: challenge.toolbox.blocks,
    assesments: challenge.assesments ?? {},
    initialBlocksXml: challenge.predefinedSolution,
    previewBlocksXml: previewXml,
    catalog: catalogFor(challenge.scene.type, blockName)
})
