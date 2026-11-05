import { SerializedChallenge } from "../serializedChallenge"
import { missionFor } from "./sceneGoals"

export type ChecklistItemId = 'title' | 'statement' | 'goals' | 'blocks'
export type ChecklistItem = { id: ChecklistItemId, ok: boolean }

/** Texts the editor starts with; they don't count as written by the teacher. */
export type ChecklistDefaults = { title?: string, statement?: string }

const isWritten = (text: string | undefined, placeholder?: string) =>
    !!text && text.trim().length > 0 && text.trim() !== placeholder?.trim()

/**
 * Requirements to publish a challenge: a title and a statement that are not the defaults,
 * at least one goal object in every scenario and at least one available block.
 */
export const publishChecklist = (challenge: SerializedChallenge | null, defaults: ChecklistDefaults = {}): ChecklistItem[] => [
    { id: 'title', ok: isWritten(challenge?.title, defaults.title) },
    { id: 'statement', ok: isWritten(challenge?.statement.description, defaults.statement) },
    { id: 'goals', ok: !!challenge && challenge.scene.maps.length > 0 && challenge.scene.maps.every(map => missionFor(challenge.scene.type, map).length > 0) },
    { id: 'blocks', ok: !!challenge && challenge.toolbox.blocks.length > 0 }
]

export const missingItems = (items: ChecklistItem[]) => items.filter(item => !item.ok)
