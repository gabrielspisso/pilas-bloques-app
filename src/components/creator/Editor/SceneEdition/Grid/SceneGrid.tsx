import { Box, Stack } from "@mui/material"
import { SceneType, SerializedChallenge, defaultChallenge } from "../../../../serializedChallenge"
import { LocalStorage } from "../../../../../localStorage"
import styles from "./grid.module.css"
import { SceneCell } from "./SceneCell"
import { useContext, CSSProperties, useEffect, useRef, useState } from "react"
import { CreatorContext } from "../../CreatorContext"
import { CELL_COLUMN_ATTRIBUTE, CELL_ROW_ATTRIBUTE, SCENE_GRID_ATTRIBUTE } from "../SceneDrag"
import { Position } from "./SceneCell"
import { applyTool, EMPTY, samePosition } from "../mapUtils"
import { useTranslation } from "react-i18next"
import { useThemeContext } from "../../../../../theme/ThemeContext"

export type SceneGridProps = {
    styling?: CSSProperties
}

const GRID_MARGIN_PX = 10 // keep in sync with .grid margin in grid.module.css
const MIN_CELL_SIZE_PX = 16

type AvailableSpace = { width: number, height: number }

/**
 * Measures the space available for the grid. Returns null when it can't be measured
 * (e.g. no ResizeObserver in tests), so callers can fall back to the previous sizing.
 */
const useAvailableSpace = (ref: React.RefObject<HTMLElement>): AvailableSpace | null => {
    const [space, setSpace] = useState<AvailableSpace | null>(null)

    useEffect(() => {
        const element = ref.current
        if (!element || typeof ResizeObserver === 'undefined') return

        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect
            setSpace(prev => prev && prev.width === width && prev.height === height ? prev : { width, height })
        })
        observer.observe(element)
        return () => observer.disconnect()
    }, [ref])

    return space
}

/**
 * Square cells as big as the available space allows, without distorting the board.
 */
export const fluidGridStyle = (space: AvailableSpace | null, rows: number, columns: number): CSSProperties | null => {
    if (!space || space.width <= 0) return null
    const usableWidth = space.width - 2 * GRID_MARGIN_PX
    const usableHeight = space.height - 2 * GRID_MARGIN_PX
    const byWidth = usableWidth / columns
    const cellSize = Math.max(MIN_CELL_SIZE_PX, Math.floor(usableHeight > 0 ? Math.min(byWidth, usableHeight / rows) : byWidth))
    return { width: `${cellSize * columns}px` }
}

const KEY_MOVES: Record<string, Position> = {
    ArrowUp: { row: -1, column: 0 },
    ArrowDown: { row: 1, column: 0 },
    ArrowLeft: { row: 0, column: -1 },
    ArrowRight: { row: 0, column: 1 }
}

export const SceneGrid = (props: SceneGridProps) => {
    const { currentMap, setCurrentMap, selectedTool, index } = useContext(CreatorContext)
    const { t } = useTranslation('creator', { useSuspense: false }) // the board must render even before translations load
    const { theme } = useThemeContext()

    const storageChallenge = LocalStorage.getCreatorChallenge()
    const challenge: SerializedChallenge = storageChallenge ? storageChallenge : defaultChallenge('Duba')

    const sceneType: SceneType = challenge.scene.type

    const containerRef = useRef<HTMLDivElement>(null)
    const space = useAvailableSpace(containerRef)
    const gridStyle = fluidGridStyle(space, currentMap.length, currentMap[0]?.length || 1) || props.styling

    // Keyboard: one Tab stop (roving tabindex), arrows move, Enter/Space place the selected tool, Delete erases.
    const rows = currentMap.length
    const columns = currentMap[0]?.length || 1
    const [focused, setFocused] = useState<Position>({ row: 0, column: 0 })
    const active = { row: Math.min(focused.row, rows - 1), column: Math.min(focused.column, columns - 1) }
    const gridRef = useRef<HTMLDivElement>(null)
    const refocus = useRef(false)

    useEffect(() => {
        // Cells remount when their content changes, so focus is restored after keyboard edits/moves.
        if (!refocus.current) return
        refocus.current = false
        gridRef.current?.querySelector<HTMLElement>(`[${CELL_ROW_ATTRIBUTE}="${active.row}"][${CELL_COLUMN_ATTRIBUTE}="${active.column}"]`)?.focus()
    })

    const handleKeyDown = (event: React.KeyboardEvent) => {
        const move = KEY_MOVES[event.key]
        if (move) {
            event.preventDefault()
            setFocused({
                row: Math.max(0, Math.min(rows - 1, active.row + move.row)),
                column: Math.max(0, Math.min(columns - 1, active.column + move.column))
            })
            refocus.current = true
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setCurrentMap(applyTool(currentMap, selectedTool, active))
            refocus.current = true
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault()
            setCurrentMap(applyTool(currentMap, EMPTY, active))
            refocus.current = true
        }
    }

    const handleFocus = (event: React.FocusEvent) => {
        const cell = (event.target as HTMLElement).closest?.(`[${CELL_ROW_ATTRIBUTE}]`)
        if (!cell) return
        const position = { row: Number(cell.getAttribute(CELL_ROW_ATTRIBUTE)), column: Number(cell.getAttribute(CELL_COLUMN_ATTRIBUTE)) }
        if (!samePosition(position, active)) setFocused(position)
    }

    return <Box ref={containerRef} sx={{ flex: 1, alignSelf: 'stretch', minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack justifyContent='flex-start' className={styles.grid} data-testid="dummy-test-scene-grid" {...{ [SCENE_GRID_ATTRIBUTE]: true }}
            ref={gridRef}
            role="grid"
            aria-label={t('editor.board.label', { scenario: index + 1, rows, columns })!}
            aria-describedby="scene-grid-instructions"
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            style={{ ...gridStyle, ['--creator-focus-color' as any]: theme.palette.primary.main }}>
            <span id="scene-grid-instructions" className={styles['visually-hidden']}>{t('editor.board.instructions')}</span>
            {currentMap.map((row, i) =>
                <Stack key={i + row.join(',')} direction="row" data-testid="challenge-row" role="row">
                    {row.map((cellContent, j) =>
                        <SceneCell
                            position={{ row: i, column: j }}
                            key={i * 100 + j + cellContent}
                            content={cellContent}
                            tabIndex={i === active.row && j === active.column ? 0 : -1}
                            sceneType={sceneType} />)}
                </Stack>)}
        </Stack>
    </Box>
}
