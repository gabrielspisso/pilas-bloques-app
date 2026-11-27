import fs from 'fs'
import path from 'path'

const publicFile = (name: string) => fs.readFileSync(path.join(__dirname, '../../../../../public', name), 'utf8')
const source = publicFile('pilas-hidpi.js')

const setDpr = (value: number) => Object.defineProperty(window, 'devicePixelRatio', { value, configurable: true })

const setWidth = (value: number) => Object.defineProperty(window, 'innerWidth', { value, configurable: true })

const global = window as any
let calls: unknown[][]

// Minimal stand-ins for the pilasweb and EaselJS internals patched by the script.
// Plain functions instead of jest.fn: `resetMocks` would drop their implementations.
const defineFakes = () => {
  calls = []

  global.Pilas = function () { }
  global.Pilas.prototype.definir_tamano_del_canvas = function () {
    this.canvas.width = this.opciones.ancho
    this.canvas.height = this.opciones.alto
  }
  global.Pilas.prototype.iniciar = function () { this.definir_tamano_del_canvas() }

  const Stage: any = function () { }
  Stage.prototype.updateContext = function () { calls.push(['original']) }
  Stage.prototype._getPointerData = function () { return this._data }
  Stage.prototype._primaryPointerID = -1
  // Like EaselJS: x/y are only rewritten when the pointer is inside the canvas (or mouseMoveOutside)
  Stage.prototype._updatePointerPosition = function (id: number, e: unknown, x: number, y: number) {
    const data = this._data || (this._data = { x: 0, y: 0 })
    data.inBounds = x >= 0 && y >= 0 && x <= 839 && y <= 959
    if (data.inBounds || this.mouseMoveOutside) { data.x = x; data.y = y }
    data.rawX = x
    data.rawY = y
    if (id === this._primaryPointerID) { this.mouseX = data.x; this.mouseY = data.y }
  }
  global.createjs = { Stage }
}

const runScript = () => new Function(source)()

const sizedCanvas = (dpr: number) => {
  setDpr(dpr)
  runScript()
  const pilas = new global.Pilas()
  pilas.opciones = { ancho: 420, alto: 480 }
  pilas.canvas = {}
  pilas.definir_tamano_del_canvas()
  return pilas.canvas
}

const fakeContext = () => ({ scale: (x: number, y: number) => calls.push(['scale', x, y]) })

// innerWidth is the width at which the scene iframe shows the canvas
beforeEach(() => {
  defineFakes()
  setWidth(420)
})

afterEach(() => {
  delete global.Pilas
  delete global.createjs
  delete global.pbCanvasScale
  setDpr(1)
})

describe('pilas-hidpi.js', () => {
  test('uses twice the pixels on a 2x screen', () => {
    expect(sizedCanvas(2)).toEqual({ width: 840, height: 960 })
    expect(global.pbCanvasScale).toBe(2)
  })

  test('caps the screen density at 2', () => {
    expect(sizedCanvas(3)).toEqual({ width: 840, height: 960 })
  })

  test('keeps the logical size and context on a 1x screen', () => {
    expect(sizedCanvas(1)).toEqual({ width: 420, height: 480 })

    new global.createjs.Stage().updateContext(fakeContext())

    expect(calls).toEqual([['original']])
  })

  test('supports fractional densities', () => {
    expect(sizedCanvas(1.5)).toEqual({ width: 630, height: 720 })
  })

  test('adds pixels when the scene is shown larger than its logical size', () => {
    setWidth(630)

    expect(sizedCanvas(1)).toEqual({ width: 630, height: 720 })
  })

  test('combines the screen density with an enlarged scene, up to 3', () => {
    setWidth(525)
    expect(sizedCanvas(2)).toEqual({ width: 1050, height: 1200 })

    defineFakes()
    setWidth(840)
    expect(sizedCanvas(2)).toEqual({ width: 1260, height: 1440 })
  })

  test('does not remove pixels when the scene is shown smaller', () => {
    setWidth(300)

    expect(sizedCanvas(2)).toEqual({ width: 840, height: 960 })
  })

  test('scales the context before applying the stage transformation', () => {
    sizedCanvas(2)

    new global.createjs.Stage().updateContext(fakeContext())

    expect(calls).toEqual([['scale', 2, 2], ['original']])
  })

  test('reports pointer positions in logical coordinates', () => {
    sizedCanvas(2)
    const stage = new global.createjs.Stage()

    stage._updatePointerPosition(-1, {}, 200, 300)

    expect(stage._data).toMatchObject({ x: 100, y: 150, rawX: 100, rawY: 150 })
    expect(stage.mouseX).toBe(100)
    expect(stage.mouseY).toBe(150)
  })

  test('does not rescale the last position while the pointer is outside the canvas', () => {
    sizedCanvas(2)
    const stage = new global.createjs.Stage()
    stage._updatePointerPosition(-1, {}, 200, 300)

    stage._updatePointerPosition(-1, {}, 900, 300)
    stage._updatePointerPosition(-1, {}, 900, 300)

    expect(stage._data).toMatchObject({ x: 100, y: 150, rawX: 450, rawY: 150 })
    expect(stage.mouseX).toBe(100)
    expect(stage.mouseY).toBe(150)
  })

  const startPilas = (context: unknown) => {
    setDpr(2)
    runScript()
    const pilas = new global.Pilas()
    pilas.opciones = { ancho: 420, alto: 480 }
    pilas.canvas = { getContext: () => context }
    pilas.iniciar()
  }

  test('smooths the images after pilasweb starts', () => {
    const context = { imageSmoothingEnabled: false, imageSmoothingQuality: 'low' }
    // pilasweb disables smoothing at the end of its own start up
    global.Pilas.prototype.iniciar = function () { this.canvas.getContext('2d').imageSmoothingEnabled = false }

    startPilas(context)

    expect(context).toEqual({ imageSmoothingEnabled: true, imageSmoothingQuality: 'high' })
  })

  test('starts even without a 2d context', () => {
    expect(() => startPilas(null)).not.toThrow()
  })

  test('does nothing without pilasweb', () => {
    delete global.Pilas

    expect(runScript).not.toThrow()
  })

  test('pilas.html loads it between pilasweb and the exercises', () => {
    const html = publicFile('pilas.html')
    const positions = ['libs/pilasweb.js', 'pilas-hidpi.js', 'libs/pilas-bloques-exercises.js'].map(script => html.indexOf(script))

    expect(positions[0]).toBeGreaterThan(-1)
    expect(positions[1]).toBeGreaterThan(positions[0])
    expect(positions[2]).toBeGreaterThan(positions[1])
  })
})
