import { Assesments } from "../../serializedChallenge"
import { checkAssessments } from "./assessmentCheck"
import { MOVES, parseMap } from "./grid"
import { SceneModel, borderSensor, obstacleSensor, runProgram, sensorFor } from "./sceneModel"
import { Direction, Program, Statement } from "./types"

type Until = Extract<Statement, { kind: 'until' }>

/** A stretch that could become a "Repeat until": a repetition, or a run of equal moves. */
type Candidate = {
    times: number
    direction: Direction
    body: Statement[]
    replace: (node: Statement) => Program
}

const moveDirection = (statement: Statement | undefined): Direction | undefined =>
    statement?.kind === 'action' && Object.prototype.hasOwnProperty.call(MOVES, statement.block) ? MOVES[statement.block] : undefined

/** Candidates in reading order: the main program first, then each procedure. */
const findCandidates = (program: Program): Candidate[] => {
    const candidates: Candidate[] = []

    const walk = (statements: Statement[], rebuild: (list: Statement[]) => Program) => {
        const splice = (from: number, to: number, node: Statement) =>
            rebuild([...statements.slice(0, from), node, ...statements.slice(to)])
        let runEnd = 0
        statements.forEach((statement, i) => {
            if (statement.kind === 'repeat') {
                const direction = moveDirection(statement.body[statement.body.length - 1])
                if (direction) candidates.push({ times: statement.times, direction, body: statement.body, replace: node => splice(i, i + 1, node) })
            }
            const direction = moveDirection(statement)
            if (direction && i >= runEnd) {
                let end = i + 1
                while (moveDirection(statements[end]) && (statements[end] as typeof statement & { block: string }).block === (statement as { block: string }).block) end++
                if (end - i >= 2) candidates.push({ times: end - i, direction, body: [statement], replace: node => splice(i, end, node) })
                runEnd = end
            }
            if ('body' in statement)
                walk(statement.body, list => splice(i, i + 1, { ...statement, body: list }))
        })
    }

    walk(program.main, main => ({ ...program, main }))
    program.procedures.forEach((procedure, index) => walk(procedure.body, body =>
        ({ ...program, procedures: program.procedures.map((other, i) => i === index ? { ...other, body } : other) })))
    return candidates
}

export type UntilResult =
    | { converted: true, program: Program }
    | { converted: false, program: Program, reason: 'missingBlocks' | 'noLandmark', blocks?: string[] }

/** The condition is really executed: on every scenario it must solve and stop exactly where the repetition did. */
const isHonest = (model: SceneModel, maps: string[][][], program: Program, node: Until, times: number) => {
    let executions = 0
    return maps.every(map => {
        const run = runProgram(model, map, program)
        const loops = run.loops.filter(loop => loop.node === node)
        executions += loops.length
        return run.solved && loops.every(loop => loop.times === times)
    }) && executions > 0
}

/**
 * Turns one stretch (the one with most turns) into "Repeat until (sensor)", when a sensor of the
 * toolbox really becomes true right where the stretch ends. `maps` are the scenarios the program solves.
 */
export const untilPass = (model: SceneModel, program: Program, maps: string[][][], toolbox: string[], assesments?: Assesments): UntilResult => {
    const candidates = findCandidates(program).sort((a, b) => b.times - a.times)
    const objectSensors = model.letters.flatMap(letter => sensorFor(model, letter) ?? [])
    const sensorsFor = (direction: Direction) => [borderSensor(direction), obstacleSensor(direction), ...objectSensors]

    const lettersPresent = new Set(maps.flatMap(map => parseMap(map).objects.map(({ letter }) => letter)))
    const useful = Array.from(new Set([
        ...candidates.map(({ direction }) => borderSensor(direction)),
        ...objectSensors.filter(sensor => lettersPresent.has(model.sensors[sensor]))
    ]))
    const hasSensor = ['right', 'down', 'left', 'up'].some(d => sensorsFor(d as Direction).some(sensor => toolbox.includes(sensor)))
    const missing = [...(toolbox.includes('Hasta') ? [] : ['Hasta']), ...(hasSensor ? [] : useful)]
    if (missing.length) return { converted: false, program, reason: 'missingBlocks', blocks: missing }

    const unmet = (candidate: Program) => checkAssessments(candidate, toolbox, assesments).length
    const before = unmet(program)
    let fallback: Program | undefined

    for (const { times, direction, body, replace } of candidates) {
        for (const sensor of sensorsFor(direction).filter(id => toolbox.includes(id))) {
            const node: Until = { kind: 'until', sensor, body }
            const converted = replace(node)
            if (!isHonest(model, maps, converted, node, times)) continue
            // Better one that does not break another assessment (e.g. losing the only "Repeat").
            if (unmet(converted) < before) return { converted: true, program: converted }
            fallback = fallback ?? converted
        }
    }
    return fallback ? { converted: true, program: fallback } : { converted: false, program, reason: 'noLandmark' }
}
