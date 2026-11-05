import { fluidGridStyle } from '../../../../components/creator/Editor/SceneEdition/Grid/SceneGrid'

describe('Fluid grid sizing', () => {
    test('without measurement falls back (null)', () => {
        expect(fluidGridStyle(null, 3, 3)).toBeNull()
        expect(fluidGridStyle({ width: 0, height: 0 }, 3, 3)).toBeNull()
    })

    test('is limited by width when the space is tall', () => {
        // usable 300x980 -> cell = min(300/3, 980/3) = 100
        expect(fluidGridStyle({ width: 320, height: 1000 }, 3, 3)).toEqual({ width: '300px' })
    })

    test('is limited by height when the space is wide, keeping square cells', () => {
        // usable 1180x380 -> cell = min(1180/4, 380/2) = 190 -> 4 cols = 760
        expect(fluidGridStyle({ width: 1200, height: 400 }, 2, 4)).toEqual({ width: '760px' })
    })

    test('never goes below the minimum cell size', () => {
        expect(fluidGridStyle({ width: 40, height: 40 }, 10, 8)).toEqual({ width: `${16 * 8}px` })
    })
})
