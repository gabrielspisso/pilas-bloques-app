import {
    computeImageLayout, EXPORT_CELL_PX, EXPORT_MIN_TEXT_WIDTH_PX, EXPORT_PADDING_PX, exportScale, imageFileName, imagesForMap,
    MAX_CANVAS_AREA_PX, MAX_CANVAS_SIDE_PX, pieceRects, STATEMENT_LINE_PX, statementParagraphs, TEXT_GAP_PX, TITLE_LINE_PX,
    TITLE_STATEMENT_GAP_PX, wrapParagraphs, wrapText
} from '../../../../components/creator/boardImage'

// 10 px per character: easy widths to reason about.
const measure = (s: string) => s.length * 10

describe('board image layout (pure)', () => {
    test('scale follows the device pixel ratio, clamped to [1, 3]', () => {
        expect(exportScale(2, 500, 500)).toBe(2)
        expect(exportScale(1.5, 500, 500)).toBe(1.5)
        expect(exportScale(undefined, 500, 500)).toBe(1)
        expect(exportScale(0, 500, 500)).toBe(1)
        expect(exportScale(0.5, 500, 500)).toBe(1)
        expect(exportScale(4, 500, 500)).toBe(3)
    })

    test('scale is reduced so the canvas stays within browser limits', () => {
        const big = exportScale(3, 5000, 1000)
        expect(5000 * big).toBeLessThanOrEqual(MAX_CANVAS_SIDE_PX)
        const area = exportScale(3, 3000, 3000)
        expect(3000 * area * 3000 * area).toBeLessThanOrEqual(MAX_CANVAS_AREA_PX + 1)
        // The biggest board (10 x 8) with texts still exports at 2x
        const layout = computeImageLayout(10, 8, 3, 20)
        expect(exportScale(2, layout.width, layout.height)).toBe(2)
    })

    test('board only: the image is the board plus padding', () => {
        const layout = computeImageLayout(3, 4, 0, 0)
        expect(layout.width).toBe(4 * EXPORT_CELL_PX + 2 * EXPORT_PADDING_PX)
        expect(layout.height).toBe(3 * EXPORT_CELL_PX + 2 * EXPORT_PADDING_PX)
        expect(layout.board).toEqual({ x: EXPORT_PADDING_PX, y: EXPORT_PADDING_PX, width: 4 * EXPORT_CELL_PX, height: 3 * EXPORT_CELL_PX })
        expect(layout.titleY).toBeNull()
        expect(layout.statementY).toBeNull()
    })

    test('with texts: they go below the board and a narrow board is centered', () => {
        const layout = computeImageLayout(2, 2, 1, 3)
        expect(layout.width).toBe(EXPORT_MIN_TEXT_WIDTH_PX + 2 * EXPORT_PADDING_PX)
        expect(layout.board.x).toBe(EXPORT_PADDING_PX + (EXPORT_MIN_TEXT_WIDTH_PX - 2 * EXPORT_CELL_PX) / 2)
        const boardBottom = EXPORT_PADDING_PX + 2 * EXPORT_CELL_PX
        expect(layout.titleY).toBe(boardBottom + TEXT_GAP_PX)
        expect(layout.statementY).toBe(layout.titleY! + TITLE_LINE_PX + TITLE_STATEMENT_GAP_PX)
        expect(layout.height).toBe(layout.statementY! + 3 * STATEMENT_LINE_PX + EXPORT_PADDING_PX)
        // Only a statement (empty title)
        const noTitle = computeImageLayout(2, 2, 0, 1)
        expect(noTitle.titleY).toBeNull()
        expect(noTitle.statementY).toBe(boardBottom + TEXT_GAP_PX)
    })

    test('wrapText keeps lines within the width, cuts long words and adds an ellipsis', () => {
        expect(wrapText('uno dos tres cuatro', 70, measure)).toEqual(['uno dos', 'tres', 'cuatro'])
        expect(wrapText('  ', 70, measure)).toEqual([])
        expect(wrapText('abcdefghij', 40, measure)).toEqual(['abcd', 'efgh', 'ij'])
        const cut = wrapText('uno dos tres cuatro cinco', 70, measure, 2)
        expect(cut).toHaveLength(2)
        expect(cut[1].endsWith('…')).toBe(true)
        cut.forEach(line => expect(measure(line)).toBeLessThanOrEqual(70))
    })

    test('statement markdown becomes plain paragraphs, limited in lines', () => {
        expect(statementParagraphs('# Título\n\nJuntá **todos** los [tomates](http://x).\n- uno')).toEqual(['Título', 'Juntá todos los tomates.', 'uno'])
        const lines = wrapParagraphs(Array(30).fill('linea'), 100, measure, 5)
        expect(lines).toHaveLength(5)
        expect(lines[4]).toBe('linea…')
    })

    test('images for a map: the cell background and each distinct piece once', () => {
        expect(imagesForMap('Lita', [['A&T', '-'], ['O', 'T']])).toEqual([
            'imagenes/sceneImages/Lita/casilla.png', 'imagenes/sceneImages/Lita/A.png',
            'imagenes/sceneImages/Lita/O.png', 'imagenes/sceneImages/Lita/T.png'])
        // relative paths (the app also runs packaged)
        imagesForMap('Duba', [['A']]).forEach(path => expect(path.startsWith('/')).toBe(false))
    })

    test('piece positions imitate the board CSS', () => {
        const square = () => ({ width: 100, height: 100 })
        // obstacle fills the cell
        expect(pieceRects('O', 96, square)).toEqual([{ piece: 'O', x: 0, y: 0, width: 96, height: 96 }])
        // a single object: half the cell, centered, pushed down 40% of its height
        expect(pieceRects('T', 96, square)).toEqual([{ piece: 'T', x: 24, y: 0.4 * 48, width: 48, height: 48 }])
        // character: scaled 1.6 around its center, drawn last
        const [actor] = pieceRects('A', 96, square)
        expect(actor.width).toBeCloseTo(76.8)
        expect(actor.x + actor.width / 2).toBeCloseTo(24 + 24 + 1.6 * 0.15 * 48)
        const both = pieceRects('A&T', 96, square)
        expect(both.map(r => r.piece)).toEqual(['T', 'A'])
        expect(both[0].x).toBe(48) // T is the second item of the row
        // an image that failed to load is laid out as a square
        expect(pieceRects('T', 96, () => null)[0].height).toBe(48)
        // non-square images keep their aspect ratio
        expect(pieceRects('T', 96, () => ({ width: 100, height: 50 }))[0].height).toBe(24)
        expect(pieceRects('-', 96, square)).toEqual([])
    })

    test('file name: the title without characters that file systems reject', () => {
        expect(imageFileName('Mi desafío')).toBe('Mi desafío.png')
        expect(imageFileName('a/b:c?')).toBe('a-b-c-.png')
        expect(imageFileName('   ')).toBe('pilas-bloques.png')
        expect(imageFileName('')).toBe('pilas-bloques.png')
    })
})
