import { act, render, screen } from '@testing-library/react'
import * as Blockly from 'blockly/core'
import { HorizontalChallengeLayout } from '../../../../components/challengeView/HorizontalChallengeLayout'
import { MAX_SCENE_WIDTH, fittedSceneWidth } from '../../../../components/challengeView/sceneSize'

describe('fittedSceneWidth', () => {
    test('grows the scene until it fills the available height, keeping its proportion', () => {
        expect(fittedSceneWidth(420, 640, 1900)).toBe(560)
    })

    test('never gets smaller than the base width, so short windows look as before', () => {
        expect(fittedSceneWidth(420, 100, 1900)).toBe(420)
        expect(fittedSceneWidth(300, 100, 700)).toBe(300)
    })

    test('leaves most of the row to the editor', () => {
        expect(fittedSceneWidth(300, 2000, 1000)).toBe(400)
    })

    test('has a maximum width', () => {
        expect(fittedSceneWidth(420, 3000, 4000)).toBe(MAX_SCENE_WIDTH)
    })
})

describe('HorizontalChallengeLayout', () => {
    let observers: { callback: ResizeObserverCallback, elements: Element[] }[]
    let resizedWorkspaces: unknown[]

    beforeEach(() => {
        observers = []
        resizedWorkspaces = []
            ; (global as any).ResizeObserver = class {
                observer: (typeof observers)[number]
                constructor(callback: ResizeObserverCallback) {
                    this.observer = { callback, elements: [] }
                    observers.push(this.observer)
                }
                observe(element: Element) { this.observer.elements.push(element) }
                disconnect() { this.observer.elements = [] }
                unobserve() { }
            }
        jest.spyOn(Blockly, 'getMainWorkspace').mockImplementation(() => 'workspace' as any)
        jest.spyOn(Blockly, 'svgResize').mockImplementation(workspace => { resizedWorkspaces.push(workspace) })
    })

    afterEach(() => {
        delete (global as any).ResizeObserver
        jest.restoreAllMocks()
    })

    const renderLayout = () => render(<HorizontalChallengeLayout
        descriptor='new EscenaLita([])'
        editor={<div data-testid='editor' />}
        controls={<div />} />)

    const resize = (testId: string, width: number, height: number) => act(() => {
        const element = screen.getByTestId(testId)
        observers
            .filter(observer => observer.elements.includes(element))
            .forEach(observer => observer.callback([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver))
    })

    const sceneStyle = () => screen.getByTestId('scene-iframe').style

    test('uses the base size until it can measure', () => {
        renderLayout()

        // jsdom matches no media query: this is the base size of a wide window
        expect(sceneStyle().width).toBe('420px')
        expect(sceneStyle().height).toBe('480px')
    })

    test('fits the scene in the height left below the buttons', () => {
        renderLayout()

        resize('challenge-row', 1900, 700)
        resize('scene-area', 316, 656) // 640 px for the scene plus its card margins

        expect(sceneStyle().width).toBe('560px')
        expect(sceneStyle().height).toBe('640px')
    })

    test('resizes Blockly when the editor changes size', () => {
        renderLayout()

        resize('editor-area', 800, 600)

        expect(resizedWorkspaces).toEqual(['workspace'])
    })

    test('renders without ResizeObserver', () => {
        delete (global as any).ResizeObserver

        renderLayout()

        expect(sceneStyle().width).toBe('420px')
    })
})
