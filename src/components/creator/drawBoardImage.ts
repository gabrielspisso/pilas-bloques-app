import { SceneMap, SceneType } from "../serializedChallenge"
import {
    cellBackgroundPath, computeImageLayout, exportScale, imagesForMap, pieceRects, piecePath, statementParagraphs,
    STATEMENT_FONT_PX, STATEMENT_LINE_PX, textWidthFor, TITLE_FONT_PX, TITLE_LINE_PX, wrapParagraphs, wrapText
} from "./boardImage"
import { objectsInCell } from "./Editor/SceneEdition/mapUtils"

/** Drawing of the board with the browser's native Canvas API (no libraries). */

export const IMAGE_LOAD_TIMEOUT_MS = 10000
const FONT_FAMILY = 'Nunito, "Nunito Variable", sans-serif'
const BACKGROUND = '#FFFFFF'
const TITLE_COLOR = '#2E1A36'
const STATEMENT_COLOR = '#3D2B47'
const MISSING_CELL_COLOR = '#E9E2D6'
const MISSING_PIECE_COLOR = '#6A3FD1'

export type LoadedImages = { images: Map<string, HTMLImageElement>, failed: string[] }

/** Loads one image; resolves null when it fails or takes too long (never rejects). */
export const loadImage = (src: string, timeoutMs = IMAGE_LOAD_TIMEOUT_MS): Promise<HTMLImageElement | null> =>
    new Promise(resolve => {
        const image = new Image()
        const timer = setTimeout(() => done(null), timeoutMs)
        const done = (result: HTMLImageElement | null) => {
            clearTimeout(timer)
            image.onload = null
            image.onerror = null
            resolve(result)
        }
        image.onload = () => done(image)
        image.onerror = () => done(null)
        image.src = src
    })

export const loadImages = async (sources: string[]): Promise<LoadedImages> => {
    const results = await Promise.all(sources.map(async src => [src, await loadImage(src)] as const))
    const images = new Map<string, HTMLImageElement>()
    const failed: string[] = []
    results.forEach(([src, image]) => image ? images.set(src, image) : failed.push(src))
    return { images, failed }
}

export type BoardImageInput = {
    sceneType: SceneType
    map: SceneMap
    /** Texts below the board (omit them for a board-only image). */
    title?: string
    statement?: string
    devicePixelRatio?: number
}

export type BoardImageResult = { canvas: HTMLCanvasElement, failedImages: string[], scale: number }

/** Thrown when the browser can't give a 2D canvas or encode it as PNG. */
export class CanvasUnavailableError extends Error { }

const titleFont = () => `bold ${TITLE_FONT_PX}px ${FONT_FAMILY}`
const statementFont = () => `${STATEMENT_FONT_PX}px ${FONT_FAMILY}`

const waitForFonts = async () => {
    try {
        const fonts = (document as any).fonts
        if (fonts?.load) await Promise.all([fonts.load(titleFont()), fonts.load(statementFont())])
    } catch { /* the fallback font is fine */ }
}

/** Draws the board (and optionally its texts) on a new canvas sized for the device pixel ratio. */
export const drawBoardImage = async (input: BoardImageInput): Promise<BoardImageResult> => {
    const { sceneType, map } = input
    const rows = map.length
    const columns = map[0]?.length || 1
    const withText = input.title !== undefined || input.statement !== undefined

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new CanvasUnavailableError('2d context unavailable')

    if (withText) await waitForFonts()
    const loaded = await loadImages(imagesForMap(sceneType, map))

    // Texts are wrapped with the real font metrics before sizing the canvas.
    const textWidth = textWidthFor(columns)
    context.font = titleFont()
    const titleLines = withText && input.title?.trim() ? wrapText(input.title.trim(), textWidth, s => context.measureText(s).width, 3) : []
    context.font = statementFont()
    const statementLines = withText && input.statement ? wrapParagraphs(statementParagraphs(input.statement), textWidth, s => context.measureText(s).width) : []

    const layout = computeImageLayout(rows, columns, titleLines.length, statementLines.length)
    const scale = exportScale(input.devicePixelRatio, layout.width, layout.height)
    canvas.width = Math.round(layout.width * scale)
    canvas.height = Math.round(layout.height * scale)
    // Resizing the canvas resets its state.
    context.setTransform(scale, 0, 0, scale, 0, 0)
    context.imageSmoothingEnabled = true

    context.fillStyle = BACKGROUND
    context.fillRect(0, 0, layout.width, layout.height)

    const size = layout.cellSize
    const cellX = (j: number) => layout.board.x + j * size
    const cellY = (i: number) => layout.board.y + i * size

    const background = loaded.images.get(cellBackgroundPath(sceneType))
    map.forEach((row, i) => row.forEach((_, j) => {
        if (background) context.drawImage(background, cellX(j), cellY(i), size, size)
        else {
            context.fillStyle = MISSING_CELL_COLOR
            context.fillRect(cellX(j), cellY(i), size, size)
            context.strokeStyle = '#FFFFFF'
            context.strokeRect(cellX(j) + 0.5, cellY(i) + 0.5, size - 1, size - 1)
        }
    }))

    const imageOf = (piece: string) => loaded.images.get(piecePath(sceneType, piece))
    const naturalSize = (piece: string) => {
        const image = imageOf(piece)
        return image && image.naturalWidth > 0 ? { width: image.naturalWidth, height: image.naturalHeight } : null
    }
    // Pieces may overflow their cell (the character is scaled up), so the ones on top are drawn last:
    // first every object, then every character, like z-index on screen.
    const rects = map.flatMap((row, i) => row.flatMap((cell, j) => objectsInCell(cell).length
        ? pieceRects(cell, size, naturalSize).map(rect => ({ ...rect, x: rect.x + cellX(j), y: rect.y + cellY(i) }))
        : []))
    const ordered = rects.filter(r => r.piece !== 'A').concat(rects.filter(r => r.piece === 'A'))
    ordered.forEach(rect => {
        const image = imageOf(rect.piece)
        if (image) return context.drawImage(image, rect.x, rect.y, rect.width, rect.height)
        drawMissingPiece(context, rect.piece, rect.x, rect.y, Math.min(rect.width, rect.height))
    })

    context.textBaseline = 'top'
    context.textAlign = 'left'
    if (layout.titleY !== null) {
        context.font = titleFont()
        context.fillStyle = TITLE_COLOR
        titleLines.forEach((line, k) => context.fillText(line, layout.textX, layout.titleY! + k * TITLE_LINE_PX + (TITLE_LINE_PX - TITLE_FONT_PX) / 2))
    }
    if (layout.statementY !== null) {
        context.font = statementFont()
        context.fillStyle = STATEMENT_COLOR
        statementLines.forEach((line, k) => context.fillText(line, layout.textX, layout.statementY! + k * STATEMENT_LINE_PX + (STATEMENT_LINE_PX - STATEMENT_FONT_PX) / 2))
    }

    return { canvas, failedImages: loaded.failed, scale }
}

/** A piece whose image didn't load: a circle with its letter, so the board is still readable. */
const drawMissingPiece = (context: CanvasRenderingContext2D, piece: string, x: number, y: number, side: number) => {
    context.save()
    context.fillStyle = MISSING_PIECE_COLOR
    context.beginPath()
    context.arc(x + side / 2, y + side / 2, side / 2.4, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#FFFFFF'
    context.font = `bold ${Math.round(side / 2)}px ${FONT_FAMILY}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(piece, x + side / 2, y + side / 2)
    context.restore()
}

/** PNG bytes of a canvas (canvas.toBlob, which every supported browser has). */
export const canvasToPngBytes = (canvas: HTMLCanvasElement): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        if (typeof canvas.toBlob !== 'function') return reject(new CanvasUnavailableError('toBlob unavailable'))
        canvas.toBlob(blob => {
            if (!blob) return reject(new CanvasUnavailableError('PNG encoding failed'))
            blobToBytes(blob).then(resolve, reject)
        }, 'image/png')
    })

/** Blob/File contents as bytes (FileReader fallback for environments without Blob.arrayBuffer). */
export const blobToBytes = (blob: Blob): Promise<Uint8Array> => {
    if (typeof (blob as any).arrayBuffer === 'function') return blob.arrayBuffer().then(buffer => new Uint8Array(buffer))
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(blob)
    })
}

/** Starts the download of some bytes as a file. */
export const downloadBytes = (bytes: Uint8Array, fileName: string, type: string) => {
    const blob = new Blob([bytes], { type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
