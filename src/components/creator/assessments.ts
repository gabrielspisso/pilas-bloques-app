import { ExpectationConfig } from "../../staticData/challenges"
import { Assesments } from "../serializedChallenge"

export const DEFAULT_MAX_PROGRAM_LENGTH = 7
export const MIN_PROGRAM_LENGTH = 2
export const MAX_PROGRAM_LENGTH = 30

export type ChallengeGrading = {
    /** Mulang expectation ids, same ones used by the static challenges. */
    expectations: ExpectationConfig
    /** Limit for the "decomposition" expectation (the static challenges use 7). */
    maxProgramLength?: number
    /** itWorks: when false, solving the challenge does not show the final dialog. */
    hasAutomaticGrading: boolean
}

/** Translates the creator's assessments into the expectation configuration Mulang understands. */
export const assesmentsToGrading = (assesments?: Assesments): ChallengeGrading => {
    const expectations: ExpectationConfig = {}
    if (assesments?.simpleRepetition) expectations.simpleRepetition = true
    if (assesments?.conditionalRepetition) expectations.conditionalRepetition = true
    if (assesments?.conditionalAlternative) expectations.conditionalAlternative = true
    if (assesments?.decomposition) expectations.decomposition = true

    return {
        expectations,
        maxProgramLength: assesments?.decomposition?.maxProgramLength,
        hasAutomaticGrading: assesments?.itWorks !== false
    }
}

export const clampProgramLength = (value: number) =>
    Math.max(MIN_PROGRAM_LENGTH, Math.min(MAX_PROGRAM_LENGTH, Math.round(isNaN(value) ? DEFAULT_MAX_PROGRAM_LENGTH : value)))
