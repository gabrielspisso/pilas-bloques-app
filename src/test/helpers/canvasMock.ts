/**
 * jsdom has no real Canvas: this fakes the parts the board export uses (2D context, toBlob),
 * image loading and object URLs, and records what was drawn and downloaded.
 */
export type CanvasMock = {
    drawnImages: string[]
    texts: string[]
    canvases: HTMLCanvasElement[]
    downloads: { name: string, blob: Blob }[]
    /** Bytes that toBlob returns as the "encoded" PNG. */
    pngBytes: Uint8Array
    restore: () => void
}

export const mockCanvas = (options: { pngBytes: Uint8Array, failingImages?: RegExp, noContext?: boolean }): CanvasMock => {
    const mock: CanvasMock = { drawnImages: [], texts: [], canvases: [], downloads: [], pngBytes: options.pngBytes, restore: () => { } }

    const context = {
        font: '', fillStyle: '', strokeStyle: '', textBaseline: '', textAlign: '', imageSmoothingEnabled: true,
        measureText: (s: string) => ({ width: s.length * 10 }),
        drawImage: (image: HTMLImageElement) => { mock.drawnImages.push(image.getAttribute('data-src') || '') },
        fillText: (text: string) => { mock.texts.push(text) },
        fillRect: () => { }, strokeRect: () => { }, setTransform: () => { }, save: () => { }, restore: () => { },
        beginPath: () => { }, arc: () => { }, fill: () => { }
    }

    const originalGetContext = HTMLCanvasElement.prototype.getContext
    const originalToBlob = HTMLCanvasElement.prototype.toBlob
    const originalImage = window.Image
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    const originalClick = HTMLAnchorElement.prototype.click

    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
        mock.canvases.push(this)
        return options.noContext ? null : context
    } as any
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
        setTimeout(() => callback(new Blob([mock.pngBytes], { type: 'image/png' })), 0)
    }

    class FakeImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 100
        naturalHeight = 100
        private source = ''
        getAttribute(name: string) { return name === 'data-src' ? this.source : null }
        set src(value: string) {
            this.source = value
            const fails = options.failingImages?.test(value)
            setTimeout(() => fails ? this.onerror?.() : this.onload?.(), 0)
        }
        get src() { return this.source }
    }
    window.Image = FakeImage as any

    const blobs = new Map<string, Blob>()
    let counter = 0
    URL.createObjectURL = (blob: Blob) => { const url = `blob:mock/${counter++}`; blobs.set(url, blob); return url }
    URL.revokeObjectURL = () => { }
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        const blob = blobs.get(this.getAttribute('href') || '')
        if (blob) mock.downloads.push({ name: this.download, blob })
    }

    mock.restore = () => {
        HTMLCanvasElement.prototype.getContext = originalGetContext
        HTMLCanvasElement.prototype.toBlob = originalToBlob
        window.Image = originalImage
        URL.createObjectURL = originalCreate
        URL.revokeObjectURL = originalRevoke
        HTMLAnchorElement.prototype.click = originalClick
    }
    return mock
}

/** Reads a Blob in jsdom (which lacks Blob.arrayBuffer). */
export const blobBytes = (blob: Blob): Promise<Uint8Array> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
})
