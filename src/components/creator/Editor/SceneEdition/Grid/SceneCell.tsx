import styles from "./grid.module.css"
import { useContext } from "react"
import { CreatorContext } from "../../CreatorContext"
import { applyTool, samePosition } from "../mapUtils"
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
}

export type Position = {
    row: number,
    column: number
}

export const SceneCell: React.FC<CellProps> = (props) => {

    const { selectedTool, currentMap, setCurrentMap } = useContext(CreatorContext)
    const { drag, startCellDrag, shouldIgnoreClick } = useSceneDrag()
    const { theme } = useThemeContext()
    const { t } = useTranslation('creator', { useSuspense: false }) // the board must render even before translations load

    const imagePath = `imagenes/sceneImages/${props.sceneType}`
    const backgroundCellImage = `${imagePath}/casilla.png`

    const objectsInCell = props.content.split('&').filter(o => o !== '-')

    const objectStyle = (object: string) => styles[`img-${object}`] || styles['img-default']

    const hasMultipleObjects = objectsInCell.length > 1

    const isDropTarget = samePosition(drag?.over, props.position)

    const handleClick = () => {
        if (shouldIgnoreClick()) return // the click that follows a paint/move stroke
        setCurrentMap(applyTool(currentMap, selectedTool, props.position))
    }

    return <div
        data-testid="challenge-cell"
        role="gridcell"
        aria-label={cellLabel(t, props.sceneType, props.position.row, props.position.column, props.content)}
        tabIndex={props.tabIndex ?? -1}
        {...{ [CELL_ROW_ATTRIBUTE]: props.position.row, [CELL_COLUMN_ATTRIBUTE]: props.position.column }}
        className={styles.cell}
        style={{
            backgroundImage: `url(${backgroundCellImage})`,
            justifyContent: !hasMultipleObjects ? 'center' : '',
            outline: isDropTarget ? `4px solid ${theme.palette.success.main}` : undefined,
            outlineOffset: '-4px',
            boxShadow: isDropTarget ? `inset 0 0 0 999px ${alpha(theme.palette.success.main, 0.25)}` : undefined
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
