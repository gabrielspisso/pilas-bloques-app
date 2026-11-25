import { Assesments } from "../../serializedChallenge"
import { DEFAULT_MAX_PROGRAM_LENGTH } from "../assessments"
import { MOVE_TO_PREFIX } from "./grid"
import { AssessmentWarning, Program, Statement } from "./types"

/** Mulang's count(calls): the value block of "Move to" is a call too, and a repeat is not one. */
export const countCalls = (statements: Statement[]): number =>
    statements.reduce((total, statement) => {
        switch (statement.kind) {
            case 'action': return total + (statement.block.startsWith(MOVE_TO_PREFIX) ? 2 : 1)
            case 'call': return total + 1
            case 'repeat': return total + countCalls(statement.body)
            // The sensor is a call; the negation of "until" is not.
            case 'if':
            case 'until': return total + 1 + countCalls(statement.body)
        }
    }, 0)

const isControl = (statement: Statement) => 'body' in statement

const containsControl = (statements: Statement[]): boolean => statements.some(isControl)

const nestsControl = (statements: Statement[]) =>
    statements.some(statement => 'body' in statement && containsControl(statement.body))

const usesKind = (program: Program, kind: string): boolean => {
    const inside = (statements: Statement[]): boolean =>
        statements.some(statement => statement.kind === kind || ('body' in statement && inside(statement.body)))
    return inside(program.main) || program.procedures.some(procedure => inside(procedure.body))
}

type ReasonOf<Id> = Omit<Extract<AssessmentWarning, { id: Id }>, 'id'>

/** Why the conditional assessments could not be met, when the solver tried. */
export type ConditionalReasons = {
    repetition?: ReasonOf<'needsConditionalRepetition'>
    alternative?: ReasonOf<'needsConditionalAlternative'>
}

/** Mimics the Mulang expectations of the active assessments, so the dialog can say what is not met. */
export const checkAssessments = (program: Program, toolbox: string[], assesments?: Assesments, reasons: ConditionalReasons = {}): AssessmentWarning[] => {
    const warnings: AssessmentWarning[] = []

    if (assesments?.decomposition) {
        const max = assesments.decomposition.maxProgramLength ?? DEFAULT_MAX_PROGRAM_LENGTH
        const allowed = max - 1
        const mainCount = countCalls(program.main)
        if (mainCount > allowed) warnings.push({ id: 'mainTooLong', count: mainCount, max, allowed })
        program.procedures.forEach(({ name, body }) => {
            const count = countCalls(body)
            if (count > allowed) warnings.push({ id: 'procedureTooLong', name, count, max, allowed })
        })
        if (nestsControl(program.main)) warnings.push({ id: 'nestedControl', name: null })
        const tooLong = warnings.some(({ id }) => id === 'mainTooLong' || id === 'procedureTooLong')
        if (tooLong && !toolbox.includes('Procedimiento')) warnings.push({ id: 'decompositionMissingBlock' })
        program.procedures.forEach(({ name, body }) => {
            if (nestsControl(body)) warnings.push({ id: 'nestedControl', name })
        })
    }

    if (assesments?.simpleRepetition && !usesKind(program, 'repeat'))
        warnings.push({ id: 'noRepetition', reason: toolbox.includes('Repetir') ? 'nothingRepeats' : 'missingBlock' })
    if (assesments?.conditionalRepetition && !usesKind(program, 'until'))
        warnings.push({ id: 'needsConditionalRepetition', ...(reasons.repetition ?? { reason: 'notYet' }) })
    if (assesments?.conditionalAlternative && !usesKind(program, 'if'))
        warnings.push({ id: 'needsConditionalAlternative', ...(reasons.alternative ?? { reason: 'notYet' }) })

    return warnings
}
