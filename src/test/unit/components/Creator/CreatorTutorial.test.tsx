import { fireEvent, screen } from "@testing-library/react"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { CreatorTutorial } from "../../../../components/creator/Editor/CreatorTutorial"
import i18n from "../../../../i18n"

describe("CreatorTutorial", () => {
    beforeAll(() => i18n.loadNamespaces(["creator"]))
    afterEach(() => localStorage.clear())

    test("the first time it walks through three steps and is marked as seen", async () => {
        renderComponent(<CreatorTutorial />)
        expect((await screen.findByTestId("tutorial-progress")).textContent).toContain("1")
        fireEvent.click(screen.getByTestId("tutorial-next"))
        expect(screen.getByTestId("tutorial-progress").textContent).toContain("2")
        fireEvent.click(screen.getByTestId("tutorial-back"))
        expect(screen.getByTestId("tutorial-progress").textContent).toContain("1")
        fireEvent.click(screen.getByTestId("tutorial-next"))
        fireEvent.click(screen.getByTestId("tutorial-next"))
        expect(screen.getByTestId("tutorial-progress").textContent).toContain("3")
        expect(LocalStorage.getCreatorTutorialDone()).toBe(false)

        fireEvent.click(screen.getByTestId("tutorial-next"))
        expect(LocalStorage.getCreatorTutorialDone()).toBe(true)
    })

    test("it can be skipped and closes with Escape", async () => {
        renderComponent(<CreatorTutorial />)
        fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" })
        expect(LocalStorage.getCreatorTutorialDone()).toBe(true)
    })

    test("the main button has the focus, so Enter moves forward", async () => {
        renderComponent(<CreatorTutorial />)
        expect(document.activeElement).toBe(await screen.findByTestId("tutorial-next"))
    })

    test("it does not come back once seen", async () => {
        LocalStorage.saveCreatorTutorialDone()
        renderComponent(<><span data-testid="ready" /><CreatorTutorial /></>)
        await screen.findByTestId("ready")
        expect(screen.queryByTestId("creator-tutorial")).toBeNull()
    })
})
