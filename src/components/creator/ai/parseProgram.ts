import { SceneType } from "../../serializedChallenge"
import { MOVES } from "../solver/grid"
import { borderSensor, modelFor, obstacleSensor } from "../solver/sceneModel"
import { DIRECTIONS, Procedure, Program, Statement } from "../solver/types"

export const MAX_TIMES = 100
export const MAX_STATEMENTS = 500
export const MAX_LEVELS = 8
export const MAX_NAME_LENGTH = 100

/** The action and sensor blocks the simulator can run for a character, or undefined when it can't simulate it. */
export const programBlocks = (type: SceneType) => {
    const model = modelFor(type)
    return model && {
        actions: [...Object.keys(MOVES), ...Object.keys(model.actions)],
        sensors: [...DIRECTIONS.flatMap(direction => [borderSensor(direction), obstacleSensor(direction)]), ...Object.keys(model.sensors)]
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isName = (value: unknown): value is string =>
    typeof value === 'string' && !!value.trim() && value.length <= MAX_NAME_LENGTH

/** Validates a program that comes from outside the app: only known fields are kept. */
export const parseProgram = (value: unknown, type: SceneType): { program: Program } | { errors: string[] } => {
    const known = programBlocks(type)
    if (!known) return { errors: [`The simulator does not support programs for ${type}`] }
    if (!isRecord(value) || !Array.isArray(value.main) || !Array.isArray(value.procedures))
        return { errors: ['A program is an object with the lists "main" and "procedures"'] }

    const errors: string[] = []
    const fail = (message: string) => { errors.push(message); return undefined }

    const names: string[] = []
    value.procedures.forEach((procedure, i) => {
        if (!isRecord(procedure) || !isName(procedure.name) || !Array.isArray(procedure.body))
            return fail(`procedures[${i}] needs a "name" and a "body" list`)
        if (names.includes(procedure.name)) return fail(`procedures[${i}]: the name "${procedure.name}" is repeated`)
        names.push(procedure.name)
    })
    if (errors.length) return { errors }

    let count = 0
    const statements = (list: unknown[], path: string, level: number): Statement[] => {
        const parsed: Statement[] = []
        for (let i = 0; i < list.length && !errors.length; i++) {
            const statement = one(list[i], `${path}[${i}]`, level)
            if (statement) parsed.push(statement)
        }
        return parsed
    }

    const one = (item: unknown, path: string, level: number): Statement | undefined => {
        // Checked before going deeper, so a huge input can't exhaust the stack.
        if (level > MAX_LEVELS) return fail(`${path}: a program nests at most ${MAX_LEVELS} levels`)
        if (++count > MAX_STATEMENTS) return fail(`${path}: a program has at most ${MAX_STATEMENTS} statements`)
        if (!isRecord(item)) return fail(`${path} is not a statement`)
        const { kind, block, name, times, sensor, body } = item

        if (kind === 'action') return typeof block === 'string' && known.actions.includes(block) ?
            { kind, block } : fail(`${path}: "${block}" is not an action of ${type}`)
        if (kind === 'call') return typeof name === 'string' && names.includes(name) ?
            { kind, name } : fail(`${path}: there is no procedure "${name}"`)
        if (kind !== 'repeat' && kind !== 'if' && kind !== 'until') return fail(`${path}: unknown kind "${kind}"`)
        if (!Array.isArray(body)) return fail(`${path} needs a "body" list`)

        if (kind === 'repeat') {
            if (typeof times !== 'number' || !Number.isInteger(times) || times < 1 || times > MAX_TIMES)
                return fail(`${path}: "times" is a whole number from 1 to ${MAX_TIMES}`)
            return { kind, times, body: statements(body, `${path}.body`, level + 1) }
        }
        if (typeof sensor !== 'string' || !known.sensors.includes(sensor))
            return fail(`${path}: "${sensor}" is not a sensor of ${type}`)
        return { kind, sensor, body: statements(body, `${path}.body`, level + 1) }
    }

    const main = statements(value.main, 'main', 1)
    const procedures: Procedure[] = (value.procedures as Procedure[]).map(({ name, body }) =>
        ({ name, body: statements(body, `procedure "${name}"`, 1) }))

    return errors.length ? { errors } : { program: { main, procedures } }
}
