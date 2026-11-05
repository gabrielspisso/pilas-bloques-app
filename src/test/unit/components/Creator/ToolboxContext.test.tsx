import { fireEvent, screen, within } from "@testing-library/react"
import { useContext } from "react"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { defaultChallenge } from "../../../../components/serializedChallenge"
import { CreatorContext, CreatorContextProvider } from "../../../../components/creator/Editor/CreatorContext"
import { ToolBoxEditor } from "../../../../components/creator/Editor/ChallengeDetailsEdition/ToolBoxEditor/ToolBoxEditor"
import { usePublishChecklist } from "../../../../components/creator/Editor/ActionButtons/ShareChallenge/PublishChecklist"
import { CreatorViewHeader } from "../../../../components/creator/Editor/CreatorViewMode"
import i18n from "../../../../i18n"

// Blockly needs the native canvas module, which is not available in this environment.
jest.mock("../../../../components/creator/Editor/ChallengeDetailsEdition/ToolBoxEditor/ToolboxPreview", () => ({
    ToolboxPreview: () => <div data-testid="toolbox-preview-mock" />
}))

const BlocksProbe = () => {
    const { toolbox } = useContext(CreatorContext)
    const { items } = usePublishChecklist()
    return <>
        <span data-testid="context-blocks">{toolbox.blocks.join(',')}</span>
        <span data-testid="checklist-blocks-ok">{String(items.find(item => item.id === 'blocks')!.ok)}</span>
    </>
}

describe("Toolbox goes through CreatorContext", () => {
    beforeAll(() => i18n.loadNamespaces(["blocks", "creator"]))
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge("Lita")))
    afterEach(() => localStorage.clear())

    test("confirming the dialog updates the context, the checklist and LocalStorage at once", async () => {
        renderComponent(<CreatorContextProvider><ToolBoxEditor /><BlocksProbe /></CreatorContextProvider>)
        expect((await screen.findByTestId("checklist-blocks-ok")).textContent).toBe("false")

        fireEvent.click(await screen.findByTestId("toolbox-button"))
        const dialog = await screen.findByRole("dialog")
        // The first switch after "categorized" turns a whole category on.
        fireEvent.click(within(dialog).getAllByRole("checkbox")[1])
        fireEvent.click(within(dialog).getByTestId("generic-ok"))

        expect(screen.getByTestId("context-blocks").textContent).toContain("AgarrarTomate")
        expect(screen.getByTestId("checklist-blocks-ok").textContent).toBe("true")
        expect(LocalStorage.getCreatorChallenge()!.toolbox.blocks.length).toBeGreaterThan(0)
    })

    test("cancelling keeps the toolbox unchanged", async () => {
        renderComponent(<CreatorContextProvider><ToolBoxEditor /><BlocksProbe /></CreatorContextProvider>)
        fireEvent.click(await screen.findByTestId("toolbox-button"))
        const dialog = await screen.findByRole("dialog")
        fireEvent.click(within(dialog).getAllByRole("checkbox")[1])
        fireEvent.click(within(dialog).getByText("X"))
        expect(screen.getByTestId("context-blocks").textContent).toBe("")
        expect(LocalStorage.getCreatorChallenge()!.toolbox.blocks).toEqual([])
    })
})

describe("Challenge title in headers", () => {
    test("a long title stays on one line with an ellipsis and keeps the full text as a tooltip", async () => {
        const title = "T".repeat(80)
        renderComponent(<CreatorViewHeader title={title} />)
        const element = await screen.findByTestId("header-challenge-title")
        expect(element.getAttribute("title")).toBe(title)
        expect(element.className).toContain("MuiTypography-noWrap")
    })
})
