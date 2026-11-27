import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useContext } from "react"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { SerializedChallenge, defaultChallenge } from "../../../../components/serializedChallenge"
import { CreatorContext, CreatorContextProvider } from "../../../../components/creator/Editor/CreatorContext"
import { CreatorWorkspace } from "../../../../components/creator/Editor/Editor"
import { CreatorModeSwitch, useCreatorMode } from "../../../../components/creator/Editor/CreatorMode"
import i18n from "../../../../i18n"

// The real ChallengeView needs Blockly and the pilasweb iframe, which don't run in jsdom.
jest.mock("../../../../components/challengeView/ChallengeView", () => ({
    ChallengeView: ({ serializedChallenge }: { serializedChallenge: SerializedChallenge }) =>
        <div data-testid="challenge-view-mock" data-solution={serializedChallenge.predefinedSolution ?? ''} />
}))

const SendProgram = () => {
    const { setPreviewProgram } = useContext(CreatorContext)
    return <button data-testid="send-program" onClick={() => setPreviewProgram({ xml: '<xml>X</xml>', id: 1 })}>send</button>
}

const Harness = () => {
    const [mode, setMode] = useCreatorMode()
    return <CreatorContextProvider>
        <CreatorModeSwitch mode={mode} onChange={setMode} />
        <SendProgram />
        <CreatorWorkspace mode={mode} onRequestTestMode={() => setMode('test')} />
    </CreatorContextProvider>
}

const mockScreenWidth = (width: number) => {
    window.matchMedia = ((query: string) => {
        const min = Number(/min-width:\s*(\d+)/.exec(query)?.[1] ?? NaN)
        const max = Number(/max-width:\s*([\d.]+)/.exec(query)?.[1] ?? NaN)
        const matches = (!isNaN(min) && width >= min) || (!isNaN(max) && width <= max)
        return { matches, media: query, onchange: null, addListener: () => { }, removeListener: () => { }, addEventListener: () => { }, removeEventListener: () => { }, dispatchEvent: () => false }
    }) as any
}

describe("Loading a program into the live preview", () => {
    const originalMatchMedia = window.matchMedia
    beforeAll(() => i18n.loadNamespaces(["creator"]))
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge("Duba")))
    afterEach(() => {
        localStorage.clear()
        window.matchMedia = originalMatchMedia
    })

    test("switches to the test mode, shows the program and does not save it", async () => {
        mockScreenWidth(1300)
        renderComponent(<Harness />)
        expect(await screen.findByTestId("creator-edition-panel")).toBeInTheDocument()
        expect(screen.queryByTestId("challenge-view-mock")).toBeNull()

        fireEvent.click(screen.getByTestId("send-program"))

        expect(screen.getByTestId("creator-mode-test").getAttribute("aria-pressed")).toBe("true")
        await waitFor(() => expect(screen.getByTestId("challenge-view-mock").getAttribute("data-solution")).toBe("<xml>X</xml>"))
        expect(LocalStorage.getCreatorChallenge()!.predefinedSolution).toBeUndefined()
    })

    test("on narrow screens it opens the try tab", async () => {
        mockScreenWidth(800)
        LocalStorage.saveCreatorMode("test")
        renderComponent(<Harness />)
        expect(await screen.findByTestId("creator-edition-panel")).toBeInTheDocument()

        fireEvent.click(screen.getByTestId("send-program"))

        expect(screen.getByTestId("creator-live-preview")).toBeInTheDocument()
        expect(screen.queryByTestId("creator-edition-panel")).toBeNull()
        expect(screen.getByTestId("challenge-view-mock").getAttribute("data-solution")).toBe("<xml>X</xml>")
    })
})
