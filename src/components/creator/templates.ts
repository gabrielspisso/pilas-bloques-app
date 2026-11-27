import { Assesments, SceneMap, SceneType, SerializedChallenge, creatorVersion } from "../serializedChallenge"

/** A ready-made starting point. Its texts are translation keys under selection.templates.<id>. */
export type ChallengeTemplate = {
    id: string
    type: SceneType
    maps: SceneMap[]
    blocks: string[]
    assesments?: Assesments
}

const RIGHT = 'MoverACasillaDerecha'
const DOWN = 'MoverACasillaAbajo'
const UP = 'MoverACasillaArriba'

export const challengeTemplates: ChallengeTemplate[] = [
    { id: 'litaSalad', type: 'Lita', maps: [[['A', 'L', 'T', 'E']]], blocks: [RIGHT, 'AgarrarLechuga', 'AgarrarTomate', 'PrepararEnsalada'] },
    { id: 'litaTomatoes', type: 'Lita', maps: [[['A', 'T', 'T', 'T', 'T']]], blocks: [RIGHT, 'AgarrarTomate', 'Repetir'], assesments: { itWorks: true, simpleRepetition: true } },
    { id: 'dubaSteak', type: 'Duba', maps: [[['A', '-', 'P']]], blocks: [RIGHT, 'ComerChurrasco'] },
    { id: 'dubaDetour', type: 'Duba', maps: [[['A', 'O', 'P'], ['-', '-', '-']]], blocks: [RIGHT, DOWN, UP, 'ComerChurrasco'] },
    { id: 'chuyTrophy', type: 'Chuy', maps: [[['A', '-', 'T']]], blocks: [RIGHT, 'RecogerTrofeo'] },
    { id: 'chuyPingPong', type: 'Chuy', maps: [[['A', 'P', 'P', 'P']]], blocks: [RIGHT, 'RebotarUnaVezPingPong', 'Repetir'], assesments: { itWorks: true, simpleRepetition: true } },
    { id: 'manicStar', type: 'Manic', maps: [[['A', '-', 'E']]], blocks: [RIGHT, 'ObservarEstrella'] },
    { id: 'manicSky', type: 'Manic', maps: [[['A', 'E', 'P']]], blocks: [RIGHT, 'ObservarEstrella', 'ObservarPlaneta'] },
    { id: 'capyCans', type: 'Capy', maps: [[['A', 'L', 'L', 'L']]], blocks: [RIGHT, 'RecogerLata', 'Repetir'], assesments: { itWorks: true, simpleRepetition: true } },
    { id: 'capyRecycle', type: 'Capy', maps: [[['A', 'L', 'P']]], blocks: [RIGHT, 'RecogerLata', 'RecogerPapel'] },
    { id: 'yvotyNight', type: 'Yvoty', maps: [[['A', 'L', 'M']]], blocks: [RIGHT, 'DespertarLuciernaga', 'FotografiarMariposa'] },
    { id: 'yvotyPhone', type: 'Yvoty', maps: [[['A', '-'], ['-', 'C']]], blocks: [RIGHT, DOWN, 'DesbloquearCelular'] },
]

export const templatesFor = (type: SceneType) => challengeTemplates.filter(template => template.type === type)

/** Builds the template as a regular challenge file, with its texts in the current language. */
export const challengeFromTemplate = (template: ChallengeTemplate, t: (key: string) => string): SerializedChallenge => {
    const challenge: SerializedChallenge = {
        fileVersion: creatorVersion,
        title: t(`selection.templates.${template.id}.title`),
        statement: { description: t(`selection.templates.${template.id}.statement`) },
        scene: { type: template.type, maps: JSON.parse(JSON.stringify(template.maps)) },
        toolbox: { blocks: template.blocks.slice() },
        stepByStep: true
    }
    if (template.assesments) challenge.assesments = { ...template.assesments }
    return challenge
}
