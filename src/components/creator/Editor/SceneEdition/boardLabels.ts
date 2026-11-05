import { TFunction } from "i18next"
import { SceneType } from "../../../serializedChallenge"
import { ACTOR, OBSTACLE, objectsInCell } from "./mapUtils"

/** Human name of a map piece, for screen readers ("Lita", "obstáculo", "tomate"). */
export const pieceName = (t: TFunction, sceneType: SceneType, piece: string): string =>
    piece === ACTOR ? t(`selection.cards.${sceneType}.name`)
        : piece === OBSTACLE ? t('editor.objects.obstacle')
            : t(`editor.objects.${sceneType}.${piece}`)

export const cellLabel = (t: TFunction, sceneType: SceneType, row: number, column: number, content: string): string => {
    const objects = objectsInCell(content)
    const description = objects.length ? objects.map(piece => pieceName(t, sceneType, piece)).join(', ') : t('editor.board.empty')
    return t('editor.board.cell', { row: row + 1, column: column + 1, content: description })
}
