import { SceneMap, SceneType } from "../serializedChallenge"
import { ACTOR, OBSTACLE, objectsInCell } from "./Editor/SceneEdition/mapUtils"
import { statementSummary } from "./Editor/ChallengeDetailsEdition/ChallengeHeaderEdition"

/**
 * Pure layout of the exported board image (PNG). Sizes are in CSS pixels; the canvas is
 * `scale` times bigger (the device pixel ratio) so the image is sharp on high density screens.
 */

/** Size of each cell in the exported image (CSS px), independent of the size on screen. */
export const EXPORT_CELL_PX = 96
export const EXPORT_PADDING_PX = 24
/** With texts, the image is at least this wide so short boards still get readable lines. */
export const EXPORT_MIN_TEXT_WIDTH_PX = 480
export const TITLE_FONT_PX = 28
export const TITLE_LINE_PX = 36
export const STATEMENT_FONT_PX = 18
export const STATEMENT_LINE_PX = 26
export const TEXT_GAP_PX = 16
export const TITLE_STATEMENT_GAP_PX = 8
export const MAX_STATEMENT_LINES = 20
/** Device pixel ratio is clamped to this range. */
export const MIN_EXPORT_SCALE = 1
export const MAX_EXPORT_SCALE = 3
/** Canvas limits that hold in every major browser (side and area, in device pixels). */
export const MAX_CANVAS_SIDE_PX = 8192
export const MAX_CANVAS_AREA_PX = 16_000_000

export const imageFolder = (sceneType: SceneType) => `imagenes/sceneImages/${sceneType}`
export const cellBackgroundPath = (sceneType: SceneType) => `${imageFolder(sceneType)}/casilla.png`
export const piecePath = (sceneType: SceneType, piece: string) => `${imageFolder(sceneType)}/${piece}.png`

/** Every image a board needs (the cell background and one per distinct piece). */
export const imagesForMap = (sceneType: SceneType, map: SceneMap): string[] => {
    const pieces = new Set<string>()
    map.forEach(row => row.forEach(cell => objectsInCell(cell).forEach(piece => pieces.add(piece))))
    return [cellBackgroundPath(sceneType), ...Array.from(pieces).sort().map(piece => piecePath(sceneType, piece))]
}

/** Device pixel ratio clamped to [1, 3], then reduced if the canvas would exceed the browser limits. */
export const exportScale = (devicePixelRatio: number | undefined, width: number, height: number): number => {
    const ratio = devicePixelRatio && devicePixelRatio > 0 ? devicePixelRatio : 1
    let scale = Math.max(MIN_EXPORT_SCALE, Math.min(MAX_EXPORT_SCALE, ratio))
    scale = Math.min(scale, MAX_CANVAS_SIDE_PX / Math.max(width, height, 1))
    scale = Math.min(scale, Math.sqrt(MAX_CANVAS_AREA_PX / Math.max(width * height, 1)))
    return scale
}

export type ImageLayout = {
    width: number
    height: number
    cellSize: number
    board: { x: number, y: number, width: number, height: number }
    /** Top of the first title line (text is drawn with textBaseline "top"); null without texts. */
    titleY: number | null
    statementY: number | null
    textX: number
    textWidth: number
}

/** Width available for the texts of a rows x columns board. */
export const textWidthFor = (columns: number, cellSize = EXPORT_CELL_PX) =>
    Math.max(columns * cellSize, EXPORT_MIN_TEXT_WIDTH_PX)

export const computeImageLayout = (rows: number, columns: number, titleLines: number, statementLines: number, cellSize = EXPORT_CELL_PX): ImageLayout => {
    const withText = titleLines + statementLines > 0
    const boardWidth = columns * cellSize
    const boardHeight = rows * cellSize
    const contentWidth = withText ? Math.max(boardWidth, EXPORT_MIN_TEXT_WIDTH_PX) : boardWidth
    const width = contentWidth + 2 * EXPORT_PADDING_PX
    const boardY = EXPORT_PADDING_PX
    let y = boardY + boardHeight
    let titleY: number | null = null
    let statementY: number | null = null
    if (withText) {
        y += TEXT_GAP_PX
        if (titleLines > 0) {
            titleY = y
            y += titleLines * TITLE_LINE_PX
        }
        if (statementLines > 0) {
            if (titleLines > 0) y += TITLE_STATEMENT_GAP_PX
            statementY = y
            y += statementLines * STATEMENT_LINE_PX
        }
    }
    return {
        width,
        height: y + EXPORT_PADDING_PX,
        cellSize,
        board: { x: EXPORT_PADDING_PX + (contentWidth - boardWidth) / 2, y: boardY, width: boardWidth, height: boardHeight },
        titleY,
        statementY,
        textX: EXPORT_PADDING_PX,
        textWidth: contentWidth
    }
}

/**
 * Splits text into lines no wider than maxWidth, using `measure` (canvas measureText in the app,
 * a fake in tests). Words longer than a line are cut by characters. With maxLines, the last kept
 * line ends with an ellipsis.
 */
export const wrapText = (text: string, maxWidth: number, measure: (s: string) => number, maxLines = Infinity): string[] => {
    const lines: string[] = []
    let line = ''
    const push = (l: string) => lines.push(l)
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word
        if (measure(candidate) <= maxWidth) {
            line = candidate
            continue
        }
        if (line) push(line)
        line = ''
        let rest = word
        while (measure(rest) > maxWidth && rest.length > 1) {
            let cut = rest.length - 1
            while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut--
            push(rest.slice(0, cut))
            rest = rest.slice(cut)
        }
        line = rest
    }
    if (line) push(line)
    return truncateLines(lines, maxLines, maxWidth, measure)
}

/** Markdown statement as plain paragraphs (one per non empty line), for the image. */
export const statementParagraphs = (markdown: string): string[] =>
    markdown.split(/\r?\n/).map(statementSummary).filter(Boolean)

/** Wraps every paragraph and keeps at most maxLines lines overall (the last one with an ellipsis). */
export const wrapParagraphs = (paragraphs: string[], maxWidth: number, measure: (s: string) => number, maxLines = MAX_STATEMENT_LINES): string[] =>
    truncateLines(paragraphs.flatMap(p => wrapText(p, maxWidth, measure)), maxLines, maxWidth, measure)

/** Keeps at most maxLines lines; the last kept one ends with an ellipsis that still fits. */
const truncateLines = (lines: string[], maxLines: number, maxWidth: number, measure: (s: string) => number) => {
    if (lines.length <= maxLines) return lines
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last.length && measure(`${last}…`) > maxWidth) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last.trimEnd()}…`
    return kept
}

export type Size = { width: number, height: number }
export type PieceRect = { piece: string, x: number, y: number, width: number, height: number }

/**
 * Where each piece of a cell is drawn, relative to the cell's top left corner, imitating
 * grid.module.css: the obstacle fills the cell width (vertically centered); other pieces are half
 * the cell wide, in a row aligned by their bottom edge (centered when alone); objects are pushed
 * down 40% of their height; the character is scaled 1.6 and nudged (translate 15%, 3%).
 * Returned in drawing order: the character last (it has z-index 1 on screen).
 * naturalSize: the image size, or null if it failed to load (then it is drawn as a square).
 */
export const pieceRects = (cell: string, cellSize: number, naturalSize: (piece: string) => Size | null): PieceRect[] => {
    const pieces = objectsInCell(cell)
    const sizeFor = (piece: string, width: number) => {
        const natural = naturalSize(piece)
        const ratio = natural && natural.width > 0 ? natural.height / natural.width : 1
        return { width, height: width * ratio }
    }
    if (pieces.length === 1 && pieces[0] === OBSTACLE) {
        const { width, height } = sizeFor(OBSTACLE, cellSize)
        return [{ piece: OBSTACLE, x: 0, y: (cellSize - height) / 2, width, height }]
    }
    const boxes = pieces.map(piece => ({ piece, ...sizeFor(piece, piece === OBSTACLE ? cellSize : cellSize / 2) }))
    const lineHeight = Math.max(0, ...boxes.map(b => b.height))
    const totalWidth = boxes.reduce((sum, b) => sum + b.width, 0)
    let x = pieces.length === 1 ? (cellSize - totalWidth) / 2 : 0
    const rects = boxes.map(box => {
        const top = lineHeight - box.height
        const rect = box.piece === ACTOR
            ? scaleAroundCenter({ piece: box.piece, x: x + 1.6 * 0.15 * box.width, y: top + 1.6 * 0.03 * box.height, width: box.width, height: box.height }, 1.6)
            : box.piece === OBSTACLE
                ? { piece: box.piece, x, y: top, width: box.width, height: box.height }
                : { piece: box.piece, x, y: top + 0.4 * box.height, width: box.width, height: box.height }
        x += box.width
        return rect
    })
    return rects.filter(r => r.piece !== ACTOR).concat(rects.filter(r => r.piece === ACTOR))
}

const scaleAroundCenter = (rect: PieceRect, factor: number): PieceRect => {
    const width = rect.width * factor
    const height = rect.height * factor
    return { ...rect, x: rect.x - (width - rect.width) / 2, y: rect.y - (height - rect.height) / 2, width, height }
}

/** File name for the exported image: the title without characters that file systems reject. */
export const imageFileName = (title: string): string => {
    const clean = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().replace(/^\.+/, '')
    return `${clean || 'pilas-bloques'}.png`
}
