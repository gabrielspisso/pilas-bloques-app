import { Assesments } from "../../serializedChallenge"
import { DEFAULT_MAX_PROGRAM_LENGTH } from "../assessments"
import { checkAssessments, countCalls } from "./assessmentCheck"
import { MOVE_TO_PREFIX } from "./grid"
import { Procedure, Program, Statement } from "./types"

/** A call to a procedure, written as a token so that it can be compressed like any other. */
export const CALL_PREFIX = '#call:'

/** Above this length only runs of equal tokens are compressed. */
export const MAX_COMPRESS_TOKENS = 200
export const MAX_PROC_TOKENS = 120
export const PROC_BUDGET_MS = 1500
const MAX_PROCEDURES = 3
const MAX_PROCEDURE_LENGTH = 12
const CANDIDATES_PER_ROUND = 10

export const tokenWeight = (token: string) => token.startsWith(MOVE_TO_PREFIX) ? 2 : 1
const rawWeight = (tokens: string[]) => tokens.reduce((total, token) => total + tokenWeight(token), 0)

export const toStatement = (token: string): Statement =>
    token.startsWith(CALL_PREFIX) ? { kind: 'call', name: token.slice(CALL_PREFIX.length) } : { kind: 'action', block: token }

export type CompressOptions = {
    /** false: the toolbox has no "Repeat" block */
    repeat?: boolean
    /** among equally small programs, take one that repeats something (simple repetition assessment) */
    preferRepeatOnTie?: boolean
}

export type Compressed = { statements: Statement[], cost: number }

const compressRuns = (tokens: string[], shortest: number): Compressed => {
    const statements: Statement[] = []
    let cost = 0
    for (let i = 0, j = 0; i < tokens.length; i = j) {
        for (j = i + 1; j < tokens.length && tokens[j] === tokens[i]; j++);
        const times = j - i
        const weight = tokenWeight(tokens[i])
        if (times >= shortest) {
            statements.push({ kind: 'repeat', times, body: [toStatement(tokens[i])] })
            cost += 1 + weight
        } else {
            statements.push(...tokens.slice(i, j).map(toStatement))
            cost += times * weight
        }
    }
    return { statements, cost }
}

/**
 * The smallest way to write the tokens with "Repeat" (nested ones only when `nesting`).
 * Dynamic programming over intervals [i, j).
 */
export const compress = (tokens: string[], nesting: boolean, options: CompressOptions = {}): Compressed => {
    const { repeat = true, preferRepeatOnTie = false } = options
    const length = tokens.length
    if (!repeat) return { statements: tokens.map(toStatement), cost: rawWeight(tokens) }
    if (length > MAX_COMPRESS_TOKENS) return compressRuns(tokens, preferRepeatOnTie ? 2 : 3)

    const size = length + 1
    const cost = new Int32Array(size * size)
    // 0: raw, k > 0: split at k, -p < 0: repeat with period p
    const choice = new Int32Array(size * size)
    // 1 when the chosen way of writing the interval has some repetition
    const repeats = new Uint8Array(size * size)
    const prefix = [0]
    tokens.forEach(token => prefix.push(prefix[prefix.length - 1] + tokenWeight(token)))

    for (let span = 1; span <= length; span++) {
        for (let i = 0, j = span; j <= length; i++, j++) {
            const at = i * size + j
            cost[at] = prefix[j] - prefix[i]
            /** Strictly smaller wins; on a tie the first found stays, unless a repetition is preferred. */
            const take = (candidate: number, repeated: number, chosen: number) => {
                if (candidate < cost[at] || (preferRepeatOnTie && candidate === cost[at] && repeated && !repeats[at])) {
                    cost[at] = candidate
                    repeats[at] = repeated
                    choice[at] = chosen
                }
            }
            for (let k = i + 1; k < j; k++) {
                const left = i * size + k
                const right = k * size + j
                take(cost[left] + cost[right], repeats[left] | repeats[right], k)
            }
            for (let period = 1; period <= span / 2; period++) {
                if (span % period) continue
                let periodic = true
                for (let t = i + period; periodic && t < j; t++) periodic = tokens[t] === tokens[t - period]
                if (!periodic) continue
                take(1 + (nesting ? cost[i * size + i + period] : prefix[i + period] - prefix[i]), 1, -period)
            }
        }
    }

    const build = (i: number, j: number): Statement[] => {
        const chosen = choice[i * size + j]
        if (chosen > 0) return [...build(i, chosen), ...build(chosen, j)]
        if (chosen < 0) {
            const period = -chosen
            const body = nesting ? build(i, i + period) : tokens.slice(i, i + period).map(toStatement)
            return [{ kind: 'repeat', times: (j - i) / period, body }]
        }
        return tokens.slice(i, j).map(toStatement)
    }

    return { statements: length ? build(0, length) : [], cost: length ? cost[length] : 0 }
}

type Definition = { name: string, tokens: string[] }

const buildProgram = (main: string[], definitions: Definition[], nesting: boolean, options: CompressOptions) => {
    const compressedMain = compress(main, nesting, options)
    let cost = compressedMain.cost
    const procedures: Procedure[] = definitions.map(({ name, tokens }) => {
        const body = compress(tokens, nesting, options)
        cost += 1 + body.cost
        return { name, body: body.statements }
    })
    return { program: { main: compressedMain.statements, procedures }, cost }
}

/** Start positions of the non overlapping appearances of `word`, left to right. */
const appearances = (tokens: string[], word: string[]) => {
    const found: number[] = []
    for (let i = 0; i + word.length <= tokens.length; i++) {
        if (word.every((token, offset) => tokens[i + offset] === token)) {
            found.push(i)
            i += word.length - 1
        }
    }
    return found
}

const replaceWord = (tokens: string[], word: string[], replacement: string) => {
    const starts = new Set(appearances(tokens, word))
    const result: string[] = []
    for (let i = 0; i < tokens.length; i++) {
        if (starts.has(i)) {
            result.push(replacement)
            i += word.length - 1
        } else result.push(tokens[i])
    }
    return result
}

const procedureCandidates = (tokens: string[]) => {
    const candidates: { word: string[], saving: number, first: number }[] = []
    const seen = new Set<string>()
    for (let length = 2; length <= MAX_PROCEDURE_LENGTH; length++) {
        for (let first = 0; first + length <= tokens.length; first++) {
            const word = tokens.slice(first, first + length)
            const key = word.join(' ')
            if (seen.has(key) || word.some(token => token.startsWith(CALL_PREFIX))) continue
            seen.add(key)
            const times = appearances(tokens, word).length
            if (times < 2) continue
            const weight = rawWeight(word)
            candidates.push({ word, first, saving: times * weight - (times + 1 + weight) })
        }
    }
    return candidates
        .sort((a, b) => b.saving - a.saving || b.word.length - a.word.length || a.first - b.first)
        .slice(0, CANDIDATES_PER_ROUND)
}

/** Up to three rounds, each one turning a repeated stretch of the main program into a procedure. */
export const extractProcedures = (tokens: string[], nesting: boolean, procedureName: (n: number) => string, options: CompressOptions = {}) => {
    const deadline = Date.now() + PROC_BUDGET_MS
    let main = tokens
    let definitions: Definition[] = []
    let best = buildProgram(main, definitions, nesting, options)

    for (let round = 1; round <= MAX_PROCEDURES; round++) {
        const name = procedureName(round)
        let accepted: { main: string[], definitions: Definition[], result: typeof best } | undefined
        for (const { word } of procedureCandidates(main)) {
            if (Date.now() > deadline) break
            const nextMain = replaceWord(main, word, CALL_PREFIX + name)
            const nextDefinitions = definitions.concat({ name, tokens: word })
            const result = buildProgram(nextMain, nextDefinitions, nesting, options)
            if (result.cost < (accepted?.result ?? best).cost) accepted = { main: nextMain, definitions: nextDefinitions, result }
        }
        if (!accepted) break
        main = accepted.main
        definitions = accepted.definitions
        best = accepted.result
    }
    return best
}

const countStatements = (statements: Statement[]): number =>
    statements.reduce((total, statement) => {
        switch (statement.kind) {
            case 'action': return total + tokenWeight(statement.block)
            case 'call': return total + 1
            case 'repeat': return total + 1 + countStatements(statement.body)
            // The control block and its sensor.
            case 'if':
            case 'until': return total + 2 + countStatements(statement.body)
        }
    }, 0)

/** Blocks the program takes in the workspace (numbers and the entry point do not count). */
export const countBlocks = ({ main, procedures }: Program) =>
    procedures.reduce((total, procedure) => total + 1 + countStatements(procedure.body), countStatements(main))

/** Expands repetitions and calls back into tokens. Programs with conditions have to be run instead. */
export const flatten = ({ main, procedures }: Program): string[] => {
    const expand = (statements: Statement[]): string[] => statements.flatMap(statement => {
        switch (statement.kind) {
            case 'action': return [statement.block]
            case 'call': return expand(procedures.find(procedure => procedure.name === statement.name)?.body ?? [])
            case 'repeat': {
                const body = expand(statement.body)
                return Array.from({ length: statement.times }, () => body).flat()
            }
            case 'if':
            case 'until': throw new Error('A program with conditions cannot be flattened')
        }
    })
    return expand(main)
}

export const rawProgram = (tokens: string[]): Program => ({ main: tokens.map(toStatement), procedures: [] })

/**
 * Splits whatever is longer than `allowed` calls into procedures: consecutive stretches that fit,
 * sharing one procedure when equal, again and again until the caller fits too. It stops when a
 * round does not make the list shorter (the limit is too small for that).
 */
export const decompose = ({ main, procedures }: Program, allowed: number, procedureName: (n: number) => string): Program => {
    const result: Procedure[] = []
    const taken = new Set(procedures.map(({ name }) => name))
    const created: Procedure[] = []
    let number = 0

    const callTo = (body: Statement[]): Statement => {
        const key = JSON.stringify(body)
        let existing = created.find(procedure => JSON.stringify(procedure.body) === key)
        if (!existing) {
            let name = procedureName(++number)
            while (taken.has(name)) name = procedureName(++number)
            existing = { name, body }
            created.push(existing)
        }
        return { kind: 'call', name: existing.name }
    }

    const stretches = (statements: Statement[]) => {
        const found: Statement[][] = []
        let size = Infinity
        statements.forEach(statement => {
            const weight = countCalls([statement])
            if (size + weight > allowed) {
                found.push([])
                size = 0
            }
            found[found.length - 1].push(statement)
            size += weight
        })
        return found
    }

    const fit = (statements: Statement[], limit: number): Statement[] => {
        // A single control statement can be too long on its own: its body is split inside it.
        let list = statements.map(statement => 'body' in statement
            ? { ...statement, body: fit(statement.body, statement.kind === 'repeat' ? allowed : allowed - 1) }
            : statement)
        while (countCalls(list) > limit) {
            const parts = stretches(list)
            // Every stretch becomes one call (a lone call stays as it is).
            if (parts.length >= countCalls(list)) break
            list = parts.map(part => part.length === 1 && part[0].kind === 'call' ? part[0] : callTo(part))
        }
        return list
    }

    procedures.forEach(({ name, body }) => result.push({ name, body: fit(body, allowed) }))
    const fitted = fit(main, allowed)
    return { main: fitted, procedures: result.concat(created) }
}

/** Phase 2: among the candidate programs, the one that misses fewer assessments with fewer blocks. */
export const optimizeProgram = (actions: string[], toolbox: string[], assesments: Assesments | undefined, procedureName: (n: number) => string): Program => {
    const nesting = !assesments?.decomposition
    const repeat = toolbox.includes('Repetir')

    const candidates = [rawProgram(actions)]
    if (repeat) candidates.push({ main: compress(actions, nesting).statements, procedures: [] })
    if (toolbox.includes('Procedimiento') && actions.length <= MAX_PROC_TOKENS)
        candidates.push(extractProcedures(actions, nesting, procedureName, { repeat }).program)
    if (repeat && assesments?.simpleRepetition)
        candidates.push({ main: compress(actions, nesting, { preferRepeatOnTie: true }).statements, procedures: [] })
    if (toolbox.includes('Procedimiento') && assesments?.decomposition) {
        const allowed = (assesments.decomposition.maxProgramLength ?? DEFAULT_MAX_PROGRAM_LENGTH) - 1
        candidates.push(...candidates.map(candidate => decompose(candidate, allowed, procedureName)))
    }

    const score = (program: Program) => [checkAssessments(program, toolbox, assesments).length, countBlocks(program), program.procedures.length]
    const scored = candidates.map(program => ({ program, score: score(program) }))
    // The sort is stable: on a full tie the simplest candidate stays first.
    scored.sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1] || a.score[2] - b.score[2])
    return scored[0].program
}
