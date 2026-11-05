import styles from "./grid.module.css"
import { useContext, useState } from "react"
import { CreatorContext } from "../../CreatorContext"
import { applyTool, MOVE_TOOL, samePosition } from "../mapUtils"
import { SceneType } from "../../../../serializedChallenge"
import { CELL_COLUMN_ATTRIBUTE, CELL_ROW_ATTRIBUTE, useSceneDrag } from "../SceneDrag"
import { useThemeContext } from "../../../../../theme/ThemeContext"
import { alpha } from "@mui/material"
import { useTranslation } from "react-i18next"
import { cellLabel } from "../boardLabels"

type CellProps = {
    position: Position
    content: string,
    sceneType: SceneType
    /** Roving tabindex: only the focused cell of the grid is reachable with Tab. */
    tabIndex?: number
    /** Content of this cell before the last edit, when it changed: new pieces get a short pop animation. */
    previousContent?: string
}

export type Position = {
    row: number,
    column: number
}

export const SceneCell: React.FC<CellProps> = (props) => {

    const { selectedTool, currentMap, setCurrentMap } = useContext(CreatorContext)
    const { drag, startCellDrag, shouldIgnoreClick, moveSelection, moveTap } = useSceneDrag()
    const { theme } = useThemeContext()
    const { t } = useTranslation('creator', { useSuspense: false }) // the board must render even before translations load

    const imagePath = `imagenes/sceneImages/${props.sceneType}`
    const backgroundCellImage = `${imagePath}/casilla.png`

    const objectsInCell = props.content.split('&').filter(o => o !== '-')

    // A cell remounts when its content changes; what was new at mount keeps its animation class on later renders.
    const [newPieces] = useState(() => props.previousContent === undefined ? [] :
        props.content.split('&').filter(object => !props.previousContent!.split('&').includes(object)))
    const isNewPiece = (object: string) => newPieces.includes(object)
    const objectStyle = (object: string) => [styles[`img-${object}`] || styles['img-default'], isNewPiece(object) ? styles['piece-pop'] : ''].filter(Boolean).join(' ')

    const hasMultipleObjects = objectsInCell.length > 1

    const isDropTarget = samePosition(drag?.over, props.position)

    const moveMode = selectedTool === MOVE_TOOL
    const isPicked = moveMode && samePosition(moveSelection?.position, props.position)
    // Move tool: pieces can be grabbed; once one is picked, any cell is a destination.
    const cursor = !moveMode ? 'pointer' : objectsInCell.length ? 'grab' : moveSelection ? 'move' : 'default'

    const handleClick = () => {
        if (shouldIgnoreClick()) return // the click that follows a paint/move stroke
        if (moveMode) return moveTap(props.position) // pick, drop or move; never paints
        setCurrentMap(applyTool(currentMap, selectedTool, props.position))
    }

    const outline = isDropTarget ? `4px solid ${theme.palette.success.main}`
        : isPicked ? `4px dashed ${theme.palette.primary.main}` : undefined

    return <div
        data-testid="challenge-cell"
        role="gridcell"
        aria-label={cellLabel(t, props.sceneType, props.position.row, props.position.column, props.content)}
        tabIndex={props.tabIndex ?? -1}
        aria-selected={moveMode ? isPicked : undefined}
        data-picked={isPicked || undefined}
        {...{ [CELL_ROW_ATTRIBUTE]: props.position.row, [CELL_COLUMN_ATTRIBUTE]: props.position.column }}
        className={styles.cell}
        style={{
            backgroundImage: `url(${backgroundCellImage})`,
            justifyContent: !hasMultipleObjects ? 'center' : '',
            outline,
            outlineOffset: '-4px',
            cursor,
            boxShadow: isDropTarget ? `inset 0 0 0 999px ${alpha(theme.palette.success.main, 0.25)}`
                : isPicked ? `inset 0 0 0 999px ${alpha(theme.palette.primary.main, 0.18)}` : undefined
        }}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={(e) => startCellDrag(e, props.position, props.content, imagePath)}
        onClick={handleClick}>
        {objectsInCell.map(obj =>
            <img
                data-testid="challenge-cell-image"
                key={props.position.row * 100 + props.position.column + obj + '-img'}
                src={`${imagePath}/${obj}.png`}
                alt=""
                draggable={false}
                className={objectStyle(obj)} />
        )}
    </div>
}
