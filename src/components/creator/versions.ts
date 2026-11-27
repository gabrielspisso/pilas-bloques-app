import { CreatorVersion } from "../../localStorage"
import { SerializedChallenge } from "../serializedChallenge"

export const MAX_VERSIONS = 5
/** Edits closer than this replace the latest version instead of adding one, so versions are spread in time. */
export const VERSION_GAP_MS = 60 * 1000

const sameContent = (a: SerializedChallenge, b: SerializedChallenge) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Returns the version list after saving `challenge` at `now` (newest last, at most MAX_VERSIONS).
 * `keepSavedAt` protects one version from being replaced (the draft as it was when the editor opened).
 */
export const addVersion = (versions: CreatorVersion[], challenge: SerializedChallenge, now: number, keepSavedAt?: number): CreatorVersion[] => {
    const last = versions[versions.length - 1]
    if (last && sameContent(last.challenge, challenge)) return versions
    const snapshot: CreatorVersion = { savedAt: now, challenge: JSON.parse(JSON.stringify(challenge)) }
    const replaceLast = last && last.savedAt !== keepSavedAt && now - last.savedAt < VERSION_GAP_MS
    const base = replaceLast ? versions.slice(0, -1) : versions
    return base.concat([snapshot]).slice(-MAX_VERSIONS)
}
