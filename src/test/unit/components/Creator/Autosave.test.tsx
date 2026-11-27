import { fireEvent, screen, within } from "@testing-library/react"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { defaultChallenge } from "../../../../components/serializedChallenge"
import { CreatorContextProvider } from "../../../../components/creator/Editor/CreatorContext"
import { AutosaveStatus } from "../../../../components/creator/Editor/EditorSubHeader/AutosaveStatus"
import { ChallengeHeaderEdition } from "../../../../components/creator/Editor/ChallengeDetailsEdition/ChallengeHeaderEdition"
import { MAX_VERSIONS, VERSION_GAP_MS, addVersion } from "../../../../components/creator/versions"
import i18n from "../../../../i18n"

const withTitle = (title: string) => ({ ...defaultChallenge("Lita"), title })

describe("addVersion", () => {
    test("adds versions spaced in time, newest last, at most MAX_VERSIONS", () => {
        let versions = addVersion([], withTitle("0"), 0)
        for (let i = 1; i <= MAX_VERSIONS + 2; i++) versions = addVersion(versions, withTitle(String(i)), i * VERSION_GAP_MS)
        expect(versions).toHaveLength(MAX_VERSIONS)
        expect(versions[versions.length - 1].challenge.title).toBe(String(MAX_VERSIONS + 2))
    })

    test("close edits replace the latest version and identical content adds nothing", () => {
        const first = addVersion([], withTitle("a"), 0)
        const second = addVersion(first, withTitle("ab"), 1000)
        expect(second).toHaveLength(1)
        expect(second[0].challenge.title).toBe("ab")
        expect(addVersion(second, withTitle("ab"), 5 * VERSION_GAP_MS)).toBe(second)
    })

    test("the protected version is never replaced", () => {
        const opened = addVersion([], withTitle("opened"), 0)
        const edited = addVersion(opened, withTitle("edited"), 1000, 0)
        expect(edited.map(v => v.challenge.title)).toEqual(["opened", "edited"])
    })
})

describe("AutosaveStatus", () => {
    beforeAll(() => i18n.loadNamespaces(["creator"]))
    beforeEach(() => LocalStorage.saveCreatorChallenge(withTitle("Original")))
    afterEach(() => localStorage.clear())

    const render = () => renderComponent(<CreatorContextProvider><AutosaveStatus /><ChallengeHeaderEdition /></CreatorContextProvider>)

    test("shows the draft as saved and switches to 'saved at' after an edit", async () => {
        render()
        const text = await screen.findByTestId("autosave-text")
        expect(text.textContent).toBe(i18n.t("editor.autosave.saved", { ns: "creator" }))
        fireEvent.change(screen.getByTestId("title-input"), { target: { value: "Nuevo" } })
        expect(screen.getByTestId("autosave-text").textContent).toMatch(/\d/)
        expect(LocalStorage.getCreatorChallenge()!.title).toBe("Nuevo")
    })

    test("the draft as it was when the editor opened can be restored", async () => {
        render()
        fireEvent.change(await screen.findByTestId("title-input"), { target: { value: "Cambiado" } })
        fireEvent.click(screen.getByTestId("autosave-status"))

        const items = within(await screen.findByTestId("versions-menu")).getAllByTestId("version-item")
        expect(items).toHaveLength(2)
        fireEvent.click(items[items.length - 1]) // oldest: when the editor opened

        expect((screen.getByTestId("title-input") as HTMLInputElement).value).toBe("Original")
        expect(LocalStorage.getCreatorChallenge()!.title).toBe("Original")
    })
})
