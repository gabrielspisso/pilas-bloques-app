import { asciiJson, InvalidPngError, insertTextChunk, isPng, readTextChunk } from "../../utils/pngMetadata"
import { creatorVersion, isValidChallenge, SerializedChallenge } from "../serializedChallenge"

/** tEXt keyword under which the exported image keeps the whole challenge (JSON with its fileVersion). */
export const CHALLENGE_PNG_KEYWORD = 'pilasbloques-challenge'

export type EmbedOptions = { includeSolution: boolean }

/** The challenge that goes inside the image: complete, optionally without its initial solution. */
export const challengeToEmbed = (challenge: SerializedChallenge, { includeSolution }: EmbedOptions): SerializedChallenge => {
    if (includeSolution) return challenge
    const { predefinedSolution, ...rest } = challenge
    return rest
}

/** A copy of the PNG that carries the challenge in a tEXt chunk (before IEND). */
export const embedChallenge = (png: Uint8Array, challenge: SerializedChallenge, options: EmbedOptions = { includeSolution: true }): Uint8Array =>
    insertTextChunk(png, CHALLENGE_PNG_KEYWORD, asciiJson(challengeToEmbed(challenge, options)))

export type ExtractResult =
    | { status: 'ok', challenge: SerializedChallenge }
    /** The bytes are not a readable PNG. */
    | { status: 'notPng' }
    /** A PNG without challenge data (any image, or one that was recompressed / a screenshot). */
    | { status: 'noData' }
    /** Made by a newer version of Pilas Bloques (fileVersion above ours). */
    | { status: 'newerVersion', fileVersion: number }
    /** There is data but it is not a valid challenge. */
    | { status: 'invalid' }

export const extractChallenge = (bytes: Uint8Array): ExtractResult => {
    if (!isPng(bytes)) return { status: 'notPng' }
    let text: string | null
    try {
        text = readTextChunk(bytes, CHALLENGE_PNG_KEYWORD)
    } catch (error) {
        if (error instanceof InvalidPngError) return { status: 'notPng' }
        throw error
    }
    if (text === null) return { status: 'noData' }
    let json: any
    try {
        json = JSON.parse(text)
    } catch {
        return { status: 'invalid' }
    }
    if (json && typeof json.fileVersion === 'number' && json.fileVersion > creatorVersion)
        return { status: 'newerVersion', fileVersion: json.fileVersion }
    return isValidChallenge(json) ? { status: 'ok', challenge: json } : { status: 'invalid' }
}
