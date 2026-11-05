import { Box, Stack } from "@mui/material"
import { SceneType, SerializedChallenge, defaultChallenge } from "../../../../serializedChallenge"
import { LocalStorage } from "../../../../../localStorage"
import styles from "./grid.module.css"
import { SceneCell } from "./SceneCell"
import { useContext, CSSProperties, useEffect, useRef, useState } from "react"
import { CreatorContext } from "../../CreatorContext"

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

export const SceneGrid = (props: SceneGridProps) => {
    const { currentMap } = useContext(CreatorContext)

    const storageChallenge = LocalStorage.getCreatorChallenge()
    const challenge: SerializedChallenge = storageChallenge ? storageChallenge : defaultChallenge('Duba')

    const sceneType: SceneType = challenge.scene.type

    const containerRef = useRef<HTMLDivElement>(null)
    const space = useAvailableSpace(containerRef)
    const gridStyle = fluidGridStyle(space, currentMap.length, currentMap[0]?.length || 1) || props.styling

    return <Box ref={containerRef} sx={{ flex: 1, alignSelf: 'stretch', minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack justifyContent='flex-start' className={styles.grid} style={gridStyle} data-testid="dummy-test-scene-grid">
            {currentMap.map((row, i) =>
                <Stack key={i + row.join(',')} direction="row" data-testid="challenge-row">
                    {row.map((cellContent, j) =>
                        <SceneCell
                            position={{ row: i, column: j }}
                            key={i * 100 + j + cellContent}
                            content={cellContent}
                            sceneType={sceneType} />)}
                </Stack>)}
        </Stack>
    </Box>
}
