import { readFileSync } from 'fs'
import { join } from 'path'
import { act, render, screen } from '@testing-library/react'
import { createTheme } from '@mui/material'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { fluidGridStyle } from '../../../../components/creator/Editor/SceneEdition/Grid/SceneGrid'
import { boardOverflows, computeCellSize, MAX_CELL_SIZE_PX, MIN_CELL_SIZE_PX } from '../../../../components/creator/Editor/SceneEdition/Grid/cellSize'
import { collapsedHeaderHeight } from '../../../../components/creator/Editor/ChallengeDetailsEdition/ChallengeHeaderEdition'
import { ThemeContext, setBlocklyTheme } from '../../../../theme/ThemeContext'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { SceneEdition } from '../../../../components/creator/Editor/SceneEdition/SceneEdition'
import { LocalStorage } from '../../../../localStorage'
import { defaultChallenge } from '../../../../components/serializedChallenge'

const css = readFileSync(join(__dirname, '../../../../components/creator/Editor/SceneEdition/Grid/grid.module.css'), 'utf8')
const rule = (selector: string) => css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1] || ''

describe('computeCellSize (pure: jsdom has no layout)', () => {
    test('limits are 44 px (touch) and about 140 px', () => {
        expect(MIN_CELL_SIZE_PX).toBe(44)
        expect(MAX_CELL_SIZE_PX).toBeGreaterThanOrEqual(130)
        expect(MAX_CELL_SIZE_PX).toBeLessThanOrEqual(150)
    })

    test('square cells limited by width when the space is tall', () => {
        expect(computeCellSize(300, 1000, 3, 3)).toBe(100)
    })

    test('square cells limited by height when the space is wide', () => {
        expect(computeCellSize(1200, 380, 4, 8)).toBe(95)
    })

    test('never above the maximum nor below the minimum', () => {
        expect(computeCellSize(2000, 2000, 1, 1)).toBe(MAX_CELL_SIZE_PX)
        expect(computeCellSize(100, 100, 10, 8)).toBe(MIN_CELL_SIZE_PX)
        expect(computeCellSize(100, 100, 10, 8, 20, 60)).toBe(20)
    })

    test('unknown height only limits by width; unmeasured space gives null', () => {
        expect(computeCellSize(360, 0, 3, 3)).toBe(120)
        expect(computeCellSize(0, 500, 3, 3)).toBeNull()
        expect(computeCellSize(NaN, 500, 3, 3)).toBeNull()
    })

    test('reports when the board overflows its container (it scrolls inside)', () => {
        expect(boardOverflows(44, 300, 300, 10, 8)).toBe(true)
        expect(boardOverflows(100, 300, 300, 3, 3)).toBe(false)
    })

    test('1280x800, Editor mode: a 3x3 board takes at least 55% of the window height', () => {
        // Estimated chrome (px): app bar 48 + subheader 60 + compact header + card margins 16 + scenario row 44
        // + mission ~64 + board padding 16. Widths: options column ~216 + palette ~110 + margins.
        const height = 800 - 48 - 60 - collapsedHeaderHeight(false) - 16 - 44 - 64 - 16
        const width = 1280 - 216 - 110 - 48
        const cell = computeCellSize(width, height, 3, 3)!
        expect(cell * 3 / 800).toBeGreaterThanOrEqual(0.55)
    })

    test('390x844 (phone): the board uses the whole width minus margins', () => {
        // Card margins 2 x 4 + board padding 2 x 8; height left after app bar, subheader, header, palette and options.
        const width = 390 - 8 - 16
        const height = 844 - 48 - 60 - collapsedHeaderHeight(true) - 90 - 70 - 44 - 64 - 16
        const cell = computeCellSize(width, height, 3, 3)!
        expect(cell * 3).toBeGreaterThanOrEqual(width - 3) // floor() loses at most 1 px per column
    })

    test('the grid style is an explicit pixel width (cells are flex 1 + aspect-ratio 1)', () => {
        expect(fluidGridStyle({ width: 320, height: 1000 }, 3, 3)).toEqual({ width: '318px' })
        expect(fluidGridStyle(null, 3, 3)).toEqual({ width: '100%' })
    })
})

describe('Board CSS: the board container scrolls inside, never the page', () => {
    test('explicit rules', () => {
        expect(rule('.board-viewport')).toMatch(/overflow:\s*auto/)
        expect(rule('.board-viewport')).toMatch(/min-width:\s*0/)
        expect(rule('.board-viewport')).toMatch(/min-height:\s*0/)
        expect(rule('.grid')).toMatch(/margin:\s*auto/)
        expect(rule('.grid')).toMatch(/flex-shrink:\s*0/)
        expect(rule('.cell')).toMatch(/aspect-ratio:\s*1\/1/)
    })
})

describe('SceneGrid measures its container with a ResizeObserver', () => {
    let callback: ResizeObserverCallback | null = null
    const observed: Element[] = []

    beforeEach(() => {
        LocalStorage.saveCreatorChallenge(defaultChallenge('Lita'))
            ; (global as any).ResizeObserver = class {
                constructor(cb: ResizeObserverCallback) { callback = cb }
                observe(element: Element) { observed.push(element) }
                disconnect() { }
                unobserve() { }
            }
    })
    afterEach(() => {
        delete (global as any).ResizeObserver
        localStorage.clear()
        observed.length = 0
    })

    const renderScene = (isSmallScreen: boolean) => render(<I18nextProvider i18n={i18n}>
        <ThemeContext.Provider value={{
            darkModeEnabled: false, setDarkModeEnabled: () => { }, simpleReadModeEnabled: false, setSimpleReadModeEnabled: () => { },
            theme: createTheme(), isSmallScreen, blocklyTheme: setBlocklyTheme(false)
        }}>
            <CreatorContextProvider><SceneEdition /></CreatorContextProvider>
        </ThemeContext.Provider>
    </I18nextProvider>)

    const resize = (width: number, height: number) => act(() => {
        callback!([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver)
    })

    test('recomputes the board width when the container is resized', async () => {
        renderScene(false)
        expect(observed).toContain(await screen.findByTestId('board-viewport'))
        resize(600, 300)
        expect(screen.getByTestId('dummy-test-scene-grid').style.width).toBe('300px') // 100 px cells, limited by height
        resize(1000, 1000)
        expect(screen.getByTestId('dummy-test-scene-grid').style.width).toBe(`${3 * MAX_CELL_SIZE_PX}px`)
        resize(90, 90)
        expect(screen.getByTestId('dummy-test-scene-grid').style.width).toBe(`${3 * MIN_CELL_SIZE_PX}px`) // scrolls inside
    })

    test('small screens: palette above the board, options below (the board is not squeezed between columns)', async () => {
        renderScene(true)
        const order = Array.from((await screen.findByTestId('scene-edition')).querySelectorAll('[data-testid="scene-tools"], [data-testid="scenarios-card"], [data-testid="grid-options"]'))
            .map(element => element.getAttribute('data-testid'))
        expect(order).toEqual(['scene-tools', 'scenarios-card', 'grid-options'])
    })

    test('wide screens: options, board, palette side by side', async () => {
        renderScene(false)
        const order = Array.from((await screen.findByTestId('scene-edition')).querySelectorAll('[data-testid="scene-tools"], [data-testid="scenarios-card"], [data-testid="grid-options"]'))
            .map(element => element.getAttribute('data-testid'))
        expect(order).toEqual(['grid-options', 'scenarios-card', 'scene-tools'])
    })
})
