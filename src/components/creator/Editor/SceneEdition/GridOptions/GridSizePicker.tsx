import { TableChartOutlined } from "@mui/icons-material"
import { Box, Button, Popover, Typography } from "@mui/material"
import { useCallback, useContext, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CreatorContext } from "../../CreatorContext"
import { GRID_LIMITS, resizeMap } from "../mapUtils"

export type GridSize = { rows: number, columns: number }

/** Size of each square of the picker and the gap between them (px). 10 x 8 squares = 254 x 206 px. */
export const PICKER_SQUARE_PX = 22
export const PICKER_GAP_PX = 4

const PICKER_ROW_ATTRIBUTE = 'data-picker-row'
const PICKER_COLUMN_ATTRIBUTE = 'data-picker-column'

const clampSize = (size: GridSize): GridSize => ({
    rows: Math.max(GRID_LIMITS.minRows, Math.min(GRID_LIMITS.maxRows, size.rows)),
    columns: Math.max(GRID_LIMITS.minColumns, Math.min(GRID_LIMITS.maxColumns, size.columns))
})

const ARROWS: Record<string, GridSize> = {
    ArrowUp: { rows: -1, columns: 0 },
    ArrowDown: { rows: 1, columns: 0 },
    ArrowLeft: { rows: 0, columns: -1 },
    ArrowRight: { rows: 0, columns: 1 }
}

/** New picker size after an arrow key, clamped to the grid limits (null for other keys). */
export const sizeAfterKey = (size: GridSize, key: string): GridSize | null => {
    const move = ARROWS[key]
    return move ? clampSize({ rows: size.rows + move.rows, columns: size.columns + move.columns }) : null
}

/** A square is highlighted when it is inside the rectangle from the top-left corner to the chosen size. */
export const isInsideSize = (row: number, column: number, size: GridSize) => row < size.rows && column < size.columns

const squareAt = (event: React.PointerEvent): GridSize | null => {
    // With touch the events keep targeting the first square, so look at what is under the finger.
    const fromPoint = event.pointerType === 'touch' && typeof document.elementFromPoint === 'function'
        ? document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null : null
    const square = (fromPoint || event.target as HTMLElement)?.closest?.(`[${PICKER_ROW_ATTRIBUTE}]`)
    if (!square) return null
    return { rows: Number(square.getAttribute(PICKER_ROW_ATTRIBUTE)) + 1, columns: Number(square.getAttribute(PICKER_COLUMN_ATTRIBUTE)) + 1 }
}

/**
 * Google Sheets-like size picker: a "rows × columns" button opens a 10 x 8 board of squares.
 * Hover (or drag a finger) to highlight a size, click (or lift the finger) to apply it.
 * Keyboard: arrows change the size, Enter applies, Escape cancels.
 * Applying is a single setCurrentMap, so it is one undo step.
 */
export const GridSizePicker = () => {
    const { t } = useTranslation("creator")
    const { currentMap, setCurrentMap } = useContext(CreatorContext)

    const current: GridSize = { rows: currentMap.length, columns: currentMap[0]?.length || 1 }

    const buttonRef = useRef<HTMLButtonElement | null>(null)
    const [open, setOpen] = useState(false)
    const [chosen, setChosen] = useState<GridSize>(current)
    const touching = useRef(false)
    const focusGrid = useCallback((element: HTMLElement | null) => element?.focus(), [])

    const openPicker = () => {
        setChosen(current)
        touching.current = false
        setOpen(true)
    }

    // touching stays set until the next open, so the click a browser fires after lifting the finger is ignored.
    const close = () => setOpen(false)

    const apply = (size: GridSize) => {
        close()
        if (size.rows !== current.rows || size.columns !== current.columns)
            setCurrentMap(resizeMap(currentMap, size.rows, size.columns))
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
        const next = sizeAfterKey(chosen, event.key)
        if (next) {
            event.preventDefault()
            setChosen(next)
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            apply(chosen)
        }
        // Escape is handled by the Popover (onClose): it cancels without changes.
    }

    const handlePointerMove = (event: React.PointerEvent) => {
        const size = squareAt(event)
        if (size) setChosen(size)
    }

    const handlePointerDown = (event: React.PointerEvent) => {
        if (event.pointerType !== 'touch') return
        touching.current = true
        const size = squareAt(event)
        if (size) setChosen(size)
    }

    const handlePointerUp = (event: React.PointerEvent) => {
        if (!touching.current) return
        event.preventDefault()
        const size = squareAt(event)
        apply(size || chosen)
    }

    const label = t('scene.size', { rows: current.rows, columns: current.columns })

    return <>
        <Button ref={buttonRef} variant="outlined" onClick={openPicker} startIcon={<TableChartOutlined />}
            aria-haspopup="dialog" aria-expanded={open} aria-label={label!} title={label!}
            data-testid="grid-size-button" sx={{ textTransform: 'none', minHeight: 44, fontSize: 18, fontWeight: 700 }}>
            {`${current.rows} × ${current.columns}`}
        </Button>
        <Popover open={open} anchorEl={buttonRef.current} onClose={close}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            disableAutoFocus // the squares get the focus (focusGrid), the focus trap keeps it inside
            PaperProps={{ role: 'dialog', 'aria-label': t('scene.pickerTitle')! } as any}>
            <Box sx={{ padding: 1.5 }}>
                <Typography variant="subtitle2" component="p" sx={{ marginBottom: 1 }}>{t('scene.pickerTitle')}</Typography>
                <Box
                    role="grid"
                    tabIndex={0}
                    ref={focusGrid}
                    aria-label={t('scene.pickerGrid', { rows: GRID_LIMITS.maxRows, columns: GRID_LIMITS.maxColumns })!}
                    aria-describedby="grid-size-picker-help"
                    data-testid="grid-size-picker"
                    onKeyDown={handleKeyDown}
                    onPointerMove={handlePointerMove}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${GRID_LIMITS.maxColumns}, ${PICKER_SQUARE_PX}px)`,
                        gap: `${PICKER_GAP_PX}px`,
                        touchAction: 'none', // a finger drag picks a size instead of scrolling
                        userSelect: 'none',
                        outline: 'none',
                        borderRadius: 1,
                        '&:focus-visible': { boxShadow: theme => `0 0 0 3px ${theme.palette.primary.main}` }
                    }}>
                    {Array.from({ length: GRID_LIMITS.maxRows }, (_, row) =>
                        <Box role="row" key={row} sx={{ display: 'contents' }}>
                            {Array.from({ length: GRID_LIMITS.maxColumns }, (_, column) => {
                                const inside = isInsideSize(row, column, chosen)
                                return <Box key={column} role="gridcell"
                                    aria-selected={inside}
                                    data-testid="grid-size-square"
                                    {...{ [PICKER_ROW_ATTRIBUTE]: row, [PICKER_COLUMN_ATTRIBUTE]: column }}
                                    onClick={() => { if (!touching.current) apply({ rows: row + 1, columns: column + 1 }) }}
                                    sx={{
                                        width: PICKER_SQUARE_PX, height: PICKER_SQUARE_PX, cursor: 'pointer', borderRadius: '3px',
                                        border: 1, borderColor: inside ? 'primary.main' : 'divider',
                                        backgroundColor: inside ? 'secondary.main' : 'background.paper'
                                    }} />
                            })}
                        </Box>)}
                </Box>
                <Typography role="status" aria-live="polite" data-testid="grid-size-picker-value" textAlign="center" sx={{ marginTop: 1, fontWeight: 700 }}>
                    {`${chosen.rows} × ${chosen.columns}`}
                </Typography>
                <Typography id="grid-size-picker-help" variant="caption" component="p" textAlign="center" sx={{ maxWidth: 220 }}>
                    {t('scene.pickerHelp')}
                </Typography>
            </Box>
        </Popover>
    </>
}
