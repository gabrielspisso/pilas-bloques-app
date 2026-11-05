import { screen, within } from "@testing-library/react"
import { createTheme } from "@mui/material"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { defaultChallenge } from "../../../../components/serializedChallenge"
import { CreatorContextProvider } from "../../../../components/creator/Editor/CreatorContext"
import { EditorSubHeader } from "../../../../components/creator/Editor/Editor"
import { CreatorModeSwitch } from "../../../../components/creator/Editor/CreatorMode"
import { PreviewButton } from "../../../../components/creator/Editor/ActionButtons/PreviewButton"
import { EmberPreviewButton } from "../../../../components/creator/Editor/ActionButtons/EmberPreviewButton"
import { EMBER_FLAG_KEY, currentEmberSignals, shouldShowEmberPreview } from "../../../../components/creator/Editor/ActionButtons/emberPreview"
import { COMPACT_ACTION_BUTTON_PX, COMPACT_ACTION_MARGIN_PX } from "../../../../components/creator/Editor/ActionButtons/CreatorActionButton"
import { ThemeContext, setBlocklyTheme } from "../../../../theme/ThemeContext"
import i18n from "../../../../i18n"

const tr = (key: string) => i18n.t(key) as string

describe("Ember preview button: hidden unless asked for", () => {
    const base = { isProduction: false, search: "", hash: "#/creador/editar", storedFlag: null }

    test("hidden by default, also in development", () => {
        expect(shouldShowEmberPreview(base)).toBe(false)
    })

    test("shown with ?ember=1 before or after the # or with the localStorage flag", () => {
        expect(shouldShowEmberPreview({ ...base, search: "?ember=1" })).toBe(true)
        expect(shouldShowEmberPreview({ ...base, hash: "#/creador/editar?ember=1" })).toBe(true)
        expect(shouldShowEmberPreview({ ...base, storedFlag: "1" })).toBe(true)
        expect(shouldShowEmberPreview({ ...base, search: "?ember=0", storedFlag: "0" })).toBe(false)
    })

    test("never in production", () => {
        expect(shouldShowEmberPreview({ ...base, isProduction: true, search: "?ember=1", storedFlag: "1" })).toBe(false)
    })

    test("reads the localStorage flag", () => {
        localStorage.setItem(EMBER_FLAG_KEY, "1")
        expect(currentEmberSignals().storedFlag).toBe("1")
        localStorage.clear()
        expect(currentEmberSignals().storedFlag).toBeNull()
    })
})

describe("Editor top bar at 390 px", () => {
    beforeAll(() => i18n.loadNamespaces(["creator"]))
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge("Lita")))
    afterEach(() => localStorage.clear())

    const renderBar = (isSmallScreen: boolean, ember = false) => renderComponent(
        <ThemeContext.Provider value={{
            darkModeEnabled: false, setDarkModeEnabled: () => { }, simpleReadModeEnabled: false, setSimpleReadModeEnabled: () => { },
            theme: createTheme(), isSmallScreen, blocklyTheme: setBlocklyTheme(false)
        }}>
            <CreatorContextProvider>
                <div data-testid="bar">
                    <EditorSubHeader viewButton={ember ? <EmberPreviewButton /> : undefined} reactViewButton={<PreviewButton />} showHistory
                        modeSwitch={<CreatorModeSwitch mode="editor" onChange={() => { }} />} />
                </div>
            </CreatorContextProvider>
        </ThemeContext.Provider>)

    test("small screens: action buttons and mode switch are icon-only, with accessible names", async () => {
        renderBar(true)
        const bar = await screen.findByTestId("bar")
        const buttons = within(bar).getAllByRole("button")
        for (const button of buttons) {
            const name = button.getAttribute("aria-label") || button.textContent
            expect(name).toBeTruthy()
        }
        // No visible label text in the action buttons nor in the mode toggles.
        expect(within(bar).getByLabelText(tr("creator:editor.buttons.share")).textContent).toBe("")
        expect(within(bar).getByLabelText(tr("creator:editor.buttons.discardChallenge")).textContent).toBe("")
        expect(within(bar).getByLabelText(tr("creator:editor.buttons.preview")).textContent).toBe("")
        expect(screen.getByTestId("creator-mode-editor").textContent).toBe("")
        expect(screen.getByTestId("creator-mode-test")).toHaveAttribute("aria-label", tr("creator:editor.mode.test"))
    })

    test("the declared widths of the small-screen bar fit in 390 px", () => {
        const action = COMPACT_ACTION_BUTTON_PX + 2 * COMPACT_ACTION_MARGIN_PX // discard, preview, share
        const undoRedo = 2 * 44 + 8 // two 44 px icon buttons (coarse pointer) and their gap
        const autosave = 48 // icon button, text visually hidden (min-width 44 + icon margins)
        const modeSwitch = 2 * 44
        expect(3 * action + undoRedo + autosave + modeSwitch).toBeLessThanOrEqual(390)
    })

    test("wide screens keep the text labels", async () => {
        renderBar(false)
        const bar = await screen.findByTestId("bar")
        expect(bar).toHaveTextContent(tr("creator:editor.buttons.share"))
        expect(bar).toHaveTextContent(tr("creator:editor.mode.test"))
    })

    test("the Ember button only renders when it is passed (Editor passes it only with the dev signal)", async () => {
        renderBar(false)
        expect(await screen.findByTestId("bar")).not.toHaveTextContent(tr("creator:editor.buttons.oldPreview"))
    })
})
