import { fireEvent, screen, waitFor } from "@testing-library/react"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { SerializedChallenge, defaultChallenge } from "../../../../components/serializedChallenge"
import { CreatorContextProvider } from "../../../../components/creator/Editor/CreatorContext"
import { CreatorWorkspace } from "../../../../components/creator/Editor/Editor"
import { CreatorModeSwitch, useCreatorMode } from "../../../../components/creator/Editor/CreatorMode"
import { isPlayable } from "../../../../components/creator/Editor/CreatorLivePreview"
import { ACTOR, EMPTY } from "../../../../components/creator/Editor/SceneEdition/mapUtils"
import i18n from "../../../../i18n"

// The real ChallengeView needs Blockly and the pilasweb iframe, which don't run in jsdom.
jest.mock("../../../../components/challengeView/ChallengeView", () => ({
    ChallengeView: ({ serializedChallenge }: { serializedChallenge: SerializedChallenge }) =>
        <div data-testid="challenge-view-mock" data-maps={JSON.stringify(serializedChallenge.scene.maps)}>{serializedChallenge.title}</div>
}))

const Harness = () => {
    const [mode, setMode] = useCreatorMode()
    return <CreatorContextProvider>
        <CreatorModeSwitch mode={mode} onChange={setMode} />
        <CreatorWorkspace mode={mode} />
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

describe("Editor / Editor con prueba", () => {
    const originalMatchMedia = window.matchMedia
    beforeAll(() => i18n.loadNamespaces(["creator"]))
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge("Lita")))
    afterEach(() => {
        localStorage.clear()
        window.matchMedia = originalMatchMedia
    })

    test("the editor mode does not mount any preview or scene", async () => {
        renderComponent(<Harness />)
        expect(await screen.findByTestId("creator-edition-panel")).toBeInTheDocument()
        expect(screen.queryByTestId("creator-live-preview")).toBeNull()
        expect(screen.queryByTestId("challenge-view-mock")).toBeNull()
        expect(screen.getByTestId("creator-mode-editor").getAttribute("aria-pressed")).toBe("true")
    })

    test("below 1200 px the test mode shows Edit and Try tabs, only one panel at a time, and the choice is remembered", async () => {
        mockScreenWidth(800)
        renderComponent(<Harness />)
        fireEvent.click(await screen.findByTestId("creator-mode-test"))
        expect(LocalStorage.getCreatorMode()).toBe("test")

        expect(screen.getByTestId("creator-edition-panel")).toBeInTheDocument()
        expect(screen.queryByTestId("creator-live-preview")).toBeNull()

        fireEvent.click(screen.getByTestId("creator-tab-try"))
        expect(screen.getByTestId("creator-live-preview")).toBeInTheDocument()
        expect(screen.queryByTestId("creator-edition-panel")).toBeNull()
        expect(screen.getAllByTestId("challenge-view-mock")).toHaveLength(1)
    })

    test("from 1200 px both panels are side by side and the preview follows the edits after the debounce", async () => {
        mockScreenWidth(1300)
        LocalStorage.saveCreatorMode("test")
        renderComponent(<Harness />)
        expect(await screen.findByTestId("creator-edition-panel")).toBeInTheDocument()
        expect(screen.getAllByTestId("challenge-view-mock")).toHaveLength(1)

        fireEvent.change(screen.getByTestId("title-input"), { target: { value: "Ensalada rápida" } })
        expect(screen.getByTestId("challenge-view-mock").textContent).toBe("")
        await waitFor(() => expect(screen.getByTestId("challenge-view-mock").textContent).toBe("Ensalada rápida"))
    })

    test("switching modes keeps the selected tool and the texts", async () => {
        mockScreenWidth(800)
        renderComponent(<Harness />)
        fireEvent.change(await screen.findByTestId("title-input"), { target: { value: "Mi desafío" } })
        fireEvent.click(screen.getByTestId("O"))
        expect(screen.getByTestId("O").getAttribute("aria-pressed")).toBe("true")

        fireEvent.click(screen.getByTestId("creator-mode-test"))
        fireEvent.click(screen.getByTestId("creator-mode-editor"))

        expect(screen.getByTestId("O").getAttribute("aria-pressed")).toBe("true")
        expect((screen.getByTestId("title-input") as HTMLInputElement).value).toBe("Mi desafío")
    })

    test("an invalid board shows a notice instead of the challenge", async () => {
        LocalStorage.saveCreatorChallenge({ ...defaultChallenge("Lita"), scene: { type: "Lita", maps: [[[EMPTY, EMPTY]]] } })
        LocalStorage.saveCreatorMode("test")
        renderComponent(<Harness />)
        fireEvent.click(await screen.findByTestId("creator-tab-try"))
        expect(await screen.findByTestId("creator-live-preview-invalid")).toBeInTheDocument()
        expect(screen.queryByTestId("challenge-view-mock")).toBeNull()
    })
})

describe("isPlayable", () => {
    const withMaps = (maps: string[][][]) => ({ ...defaultChallenge("Lita"), scene: { type: "Lita" as const, maps } })
    test("needs one actor per scenario and non-empty scenarios", () => {
        expect(isPlayable(withMaps([[[ACTOR, EMPTY]]]))).toBe(true)
        expect(isPlayable(withMaps([[[EMPTY]]]))).toBe(false)
        expect(isPlayable(withMaps([[[ACTOR, ACTOR]]]))).toBe(false)
        expect(isPlayable(withMaps([]))).toBe(false)
        expect(isPlayable(withMaps([[]]))).toBe(false)
    })
})
