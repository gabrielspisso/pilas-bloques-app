import { SceneType } from "../serializedChallenge"

export type SceneGoal = {
    /** translation key under selection.cards.<SceneType>.goals */
    key: string
    /** map cell letter of the object (also its image name) */
    cell: string
}

/** What the actor has to do with each object of its scene. Shared by the character selection and the editor mission card. */
export const sceneGoals: Partial<Record<SceneType, SceneGoal[]>> = {
    Lita: [
        { key: 'letucce', cell: 'L' },
        { key: 'tomato', cell: 'T' },
        { key: 'salad', cell: 'E' },
    ],
    Duba: [
        { key: 'steak', cell: 'P' },
    ],
    Chuy: [
        { key: 'paddle', cell: 'E' },
        { key: 'trophy', cell: 'T' },
        { key: 'pingpong', cell: 'P' },
        { key: 'pulpito', cell: 'U' },
        { key: 'football', cell: 'G' },
    ],
    Manic: [
        { key: 'telescope', cell: 'T' },
        { key: 'star', cell: 'E' },
        { key: 'planet', cell: 'P' },
    ],
    Capy: [
        { key: 'can', cell: 'L' },
        { key: 'paper', cell: 'P' },
    ],
    Yvoty: [
        { key: 'firefly', cell: 'L' },
        { key: 'butterfly', cell: 'M' },
        { key: 'unlockCellphone', cell: 'C' },
        { key: 'charger', cell: 'K' },
        { key: 'chargeCellphone', cell: 'P' },
    ],
}

export type MissionItem = SceneGoal & { count: number }

/** Goals present in a map, in the scene's goal order, with how many of each object there are. */
export const missionFor = (type: SceneType, map: string[][]): MissionItem[] => {
    const cells = map.flat().flatMap(cell => cell.split('&'))
    return (sceneGoals[type] || [])
        .map(goal => ({ ...goal, count: cells.filter(c => c === goal.cell).length }))
        .filter(goal => goal.count > 0)
}
