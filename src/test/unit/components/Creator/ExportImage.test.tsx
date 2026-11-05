import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { LocalStorage } from '../../../../localStorage'
import { defaultChallenge, SerializedChallenge } from '../../../../components/serializedChallenge'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { ShareButtons } from '../../../../components/creator/Editor/ActionButtons/ShareChallenge/ShareModalButtons'
import { computeImageLayout } from '../../../../components/creator/boardImage'
import { CanvasMock, mockCanvas } from '../../../helpers/canvasMock'

const challenge: SerializedChallenge = {
    ...defaultChallenge('Lita'),
    title: 'Mi ensalada',
    statement: { description: 'Juntá **el tomate**' },
    scene: { type: 'Lita', maps: [[['A', 'T'], ['-', 'E']], [['A', 'L', 'O']]] },
    toolbox: { blocks: ['MoverACasillaDerecha'] }
}

const renderShare = (defaultIndex = 0) => render(<I18nextProvider i18n={i18n}>
    <CreatorContextProvider defaultIndex={defaultIndex}>
        <ShareButtons />
    </CreatorContextProvider>
</I18nextProvider>)

const exportWith = async (configure?: () => void) => {
    fireEvent.click(await screen.findByTestId('export-image-button'))
    configure?.()
    fireEvent.click(screen.getByTestId('export-image-confirm'))
}

describe('Export the board as an image', () => {
    let canvas: CanvasMock
    const originalRatio = window.devicePixelRatio

    beforeAll(() => i18n.loadNamespaces(['creator']))
    beforeEach(() => {
        LocalStorage.saveCreatorChallenge(challenge)
        canvas = mockCanvas({ pngBytes: new Uint8Array([1, 2, 3]) })
        Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    })
    afterEach(() => {
        canvas.restore()
        Object.defineProperty(window, 'devicePixelRatio', { value: originalRatio, configurable: true })
        localStorage.clear()
    })

    test('the button sits next to Download in the share dialog', async () => {
        renderShare()
        const exportButton = await screen.findByTestId('export-image-button')
        expect(exportButton).toHaveTextContent(/exportar imagen/i)
        expect(exportButton.parentElement).toHaveTextContent(/descargar/i)
    })

    test('downloads <title>.png drawn at the device pixel ratio, with title and statement by default', async () => {
        renderShare()
        await exportWith(() => expect(screen.getByTestId('export-include-texts').querySelector('input')).toBeChecked())
        await waitFor(() => expect(canvas.downloads).toHaveLength(1))
        expect(canvas.downloads[0].name).toBe('Mi ensalada.png')
        expect(canvas.downloads[0].blob.type).toBe('image/png')

        const drawn = canvas.canvases[0]
        // fake measureText: 10 px per char; one title line and one statement line
        const layout = computeImageLayout(2, 2, 1, 1)
        expect(drawn.width).toBe(layout.width * 2)
        expect(drawn.height).toBe(layout.height * 2)

        expect(canvas.texts).toEqual(['Mi ensalada', 'Juntá el tomate'])
        // 4 cell backgrounds, then the pieces of the first scenario
        expect(canvas.drawnImages.filter(src => src.endsWith('casilla.png'))).toHaveLength(4)
        expect(canvas.drawnImages.filter(src => !src.endsWith('casilla.png')).sort()).toEqual(
            ['imagenes/sceneImages/Lita/A.png', 'imagenes/sceneImages/Lita/E.png', 'imagenes/sceneImages/Lita/T.png'])
    })

    test('without texts: only the board', async () => {
        renderShare()
        await exportWith(() => fireEvent.click(screen.getByTestId('export-include-texts').querySelector('input')!))
        await waitFor(() => expect(canvas.downloads).toHaveLength(1))
        expect(canvas.texts).toEqual([])
        const layout = computeImageLayout(2, 2, 0, 0)
        expect(canvas.canvases[0].width).toBe(layout.width * 2)
    })

    test('with several scenarios it exports the one being edited', async () => {
        renderShare(1)
        fireEvent.click(await screen.findByTestId('export-image-button'))
        expect(screen.getByTestId('export-image-scenario')).toHaveTextContent('2 de 2')
        fireEvent.click(screen.getByTestId('export-image-confirm'))
        await waitFor(() => expect(canvas.downloads).toHaveLength(1))
        expect(canvas.drawnImages.filter(src => src.endsWith('casilla.png'))).toHaveLength(3)
        expect(canvas.drawnImages).toContain('imagenes/sceneImages/Lita/L.png')
        expect(canvas.drawnImages).not.toContain('imagenes/sceneImages/Lita/T.png')
    })

    test('an image that fails to load is replaced by a placeholder and the user is told', async () => {
        canvas.restore()
        canvas = mockCanvas({ pngBytes: new Uint8Array([1]), failingImages: /T\.png$/ })
        renderShare()
        await exportWith()
        await waitFor(() => expect(canvas.downloads).toHaveLength(1))
        expect(canvas.drawnImages).not.toContain('imagenes/sceneImages/Lita/T.png')
        expect(canvas.texts).toContain('T') // the placeholder letter
        expect(await screen.findByText(/no se pudieron cargar/i)).toBeInTheDocument()
    })

    test('without a 2D canvas it shows an error and downloads nothing', async () => {
        canvas.restore()
        canvas = mockCanvas({ pngBytes: new Uint8Array([1]), noContext: true })
        renderShare()
        await exportWith()
        expect(await screen.findByText(/no se pudo generar la imagen/i)).toBeInTheDocument()
        expect(canvas.downloads).toHaveLength(0)
    })
})
