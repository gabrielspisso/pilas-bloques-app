/** Smallest cell: a comfortable touch target. Below it the board scrolls inside its own container. */
export const MIN_CELL_SIZE_PX = 44
/**
 * Biggest cell. Around 140 px was the target; 150 lets a 3x3 board reach 55% of an 800 px tall
 * window (3 x 140 = 420 px would only be 52.5%).
 */
export const MAX_CELL_SIZE_PX = 150

/**
 * Size (px) of the square cells of a rows x columns board that fit in the available space
 * (the content box of the board container, already without its padding).
 * Clamped to [min, max]; when even min does not fit, the container scrolls.
 * An unknown height (<= 0) only limits by width. Returns null when the space can't be measured.
 */
export const computeCellSize = (availableWidth: number, availableHeight: number, rows: number, columns: number,
    min = MIN_CELL_SIZE_PX, max = MAX_CELL_SIZE_PX): number | null => {
    if (!(availableWidth > 0) || rows < 1 || columns < 1) return null
    const byWidth = availableWidth / columns
    const fit = availableHeight > 0 ? Math.min(byWidth, availableHeight / rows) : byWidth
    return Math.max(min, Math.min(max, Math.floor(fit)))
}

/** Whether a board of that cell size overflows the space (and so the container scrolls). */
export const boardOverflows = (cellSize: number, availableWidth: number, availableHeight: number, rows: number, columns: number) =>
    cellSize * columns > availableWidth || (availableHeight > 0 && cellSize * rows > availableHeight)
