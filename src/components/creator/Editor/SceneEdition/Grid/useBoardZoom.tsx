import { Stack, Typography } from "@mui/material"
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import { MutableRefObject, RefObject, useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconButtonTooltip } from "../IconButtonTooltip"
import { boardFraction, canZoomIn, canZoomOut, clampZoom, MIN_ZOOM, Point, zoomIn, zoomOut, zoomPercent } from "./boardZoom"

/** Board point that must stay under `point` (screen coordinates) after the zoom changes. */
export type ZoomAnchor = Point & { fx: number, fy: number }

/**
 * Visual zoom state of the board (never part of the challenge nor of the undo history).
 * The board (SceneGrid) attaches its viewport and grid elements to the refs, so zoomTo can
 * remember which board point was under the pointer (or the viewport center) before resizing.
 */
export type BoardZoom = {
    zoom: number
    zoomTo: (zoom: number, point?: Point) => void
    viewportRef: RefObject<HTMLDivElement>
    gridRef: RefObject<HTMLDivElement>
    pendingAnchor: MutableRefObject<ZoomAnchor | null>
}

export const useBoardZoom = (): BoardZoom => {
    const [zoom, setZoom] = useState(MIN_ZOOM)
    const viewportRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const pendingAnchor = useRef<ZoomAnchor | null>(null)
    const current = useRef(zoom)
    current.current = zoom

    const zoomTo = useCallback((requested: number, point?: Point) => {
        const next = clampZoom(requested)
        if (next === current.current) return
        const grid = gridRef.current?.getBoundingClientRect()
        const viewport = viewportRef.current?.getBoundingClientRect()
        const anchor = point ?? (viewport ? { x: viewport.left + viewport.width / 2, y: viewport.top + viewport.height / 2 } : null)
        pendingAnchor.current = grid && anchor && grid.width > 0
            ? { ...anchor, fx: boardFraction(anchor.x, grid.left, grid.width), fy: boardFraction(anchor.y, grid.top, grid.height) }
            : null
        current.current = next
        setZoom(next)
    }, [])

    return { zoom, zoomTo, viewportRef, gridRef, pendingAnchor }
}

/** Zoom out, reset and zoom in buttons (always available, also with keyboard), with the current level. */
export const ZoomControls = ({ boardZoom }: { boardZoom: BoardZoom }) => {
    const { t } = useTranslation('creator', { useSuspense: false })
    const { zoom, zoomTo } = boardZoom
    return <Stack direction="row" alignItems="center" role="group" aria-label={t('editor.board.zoomGroup')!} data-testid="zoom-controls" sx={{ flexShrink: 0 }}>
        <IconButtonTooltip data-testid="zoom-out" icon={<ZoomOutIcon />} tooltip={t('editor.board.zoomOut')} aria-label={t('editor.board.zoomOut')!}
            disabled={!canZoomOut(zoom)} onClick={() => zoomTo(zoomOut(zoom))} />
        <Typography variant="caption" data-testid="zoom-level" role="status" aria-live="polite" sx={{ minWidth: 40, textAlign: 'center' }}
            aria-label={t('editor.board.zoomLevel', { percent: zoomPercent(zoom) })!}>
            {`${zoomPercent(zoom)} %`}
        </Typography>
        <IconButtonTooltip data-testid="zoom-in" icon={<ZoomInIcon />} tooltip={t('editor.board.zoomIn')} aria-label={t('editor.board.zoomIn')!}
            disabled={!canZoomIn(zoom)} onClick={() => zoomTo(zoomIn(zoom))} />
        <IconButtonTooltip data-testid="zoom-reset" icon={<FitScreenIcon />} tooltip={t('editor.board.zoomReset')} aria-label={t('editor.board.zoomReset')!}
            disabled={zoom === MIN_ZOOM} onClick={() => zoomTo(MIN_ZOOM)} />
    </Stack>
}
