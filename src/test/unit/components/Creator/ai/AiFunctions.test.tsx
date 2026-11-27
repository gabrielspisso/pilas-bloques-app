import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { renderComponent } from "../../../../testUtils"
import i18n from "../../../../../i18n"
import { LocalStorage } from "../../../../../localStorage"
import { SerializedChallenge } from "../../../../../components/serializedChallenge"
import { CreatorEditor } from "../../../../../components/creator/Editor/Editor"
import { CreatorContextProvider } from "../../../../../components/creator/Editor/CreatorContext"
import { GridOptions } from "../../../../../components/creator/Editor/SceneEdition/GridOptions/GridOptions"
import { AiSessionProvider } from "../../../../../components/creator/ai/AiSessionProvider"
import { AiSharingIndicator } from "../../../../../components/creator/ai/AiFunctions"
import { litaChallenge } from "./fixtures"
import { FakeSocket, installFakeSocket } from "./fakeSocket"

jest.mock("../../../../../components/challengeView/ChallengeView", () => ({
    ChallengeView: ({ serializedChallenge }: { serializedChallenge: SerializedChallenge }) =>
        <div data-testid="challenge-view-mock">{serializedChallenge.title}</div>
}))

let copied: string[]

const renderCard = () => renderComponent(<CreatorContextProvider><AiSessionProvider><AiSharingIndicator /><GridOptions /></AiSessionProvider></CreatorContextProvider>)

const openMenu = () => fireEvent.click(screen.getByTestId("ai-button"))
const openModal = () => { openMenu(); fireEvent.click(screen.getByTestId("ai-menu-connect")) }
const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } })
const share = (code = "abcd2345") => { type("ai-code", code); fireEvent.click(screen.getByTestId("ai-share")) }
const accept = () => { FakeSocket.last.open(); FakeSocket.last.receive({ type: "welcome", client: "claude-code" }) }
const gone = (testId: string) => waitFor(() => expect(screen.queryByTestId(testId)).toBeNull())
const t = (key: string, values: object = {}) => i18n.t(key, { ns: "creator", ...values }) as string

describe("AI features card", () => {
    installFakeSocket()
    const originalClipboard = navigator.clipboard
    beforeAll(() => i18n.loadNamespaces(["creator", "blocks"]))
    beforeEach(() => {
        LocalStorage.saveCreatorChallenge(litaChallenge())
        copied = []
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (text: string) => { copied.push(text); return Promise.resolve() } } })
    })
    afterEach(() => {
        localStorage.clear()
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: originalClipboard })
    })

    test("is after the solver card", () => {
        renderCard()

        const ids = Array.from(screen.getByTestId("grid-options").querySelectorAll("[data-testid]")).map(node => node.getAttribute("data-testid"))

        expect(ids.indexOf("ai-button")).toBeGreaterThan(ids.indexOf("solver-button"))
        expect(screen.getByTestId("ai-button")).toHaveAccessibleName(t("ai.button"))
    })

    describe("without a connection", () => {
        test("offers only to connect", () => {
            renderCard()

            openMenu()

            expect(screen.getByTestId("ai-menu-connect")).toBeInTheDocument()
            expect(screen.queryByTestId("ai-menu-stop")).toBeNull()
            expect(screen.queryByTestId("ai-menu-remove-initial")).toBeNull()
            expect(screen.queryByTestId("ai-indicator")).toBeNull()
        })

        test("opens the guide with opencode first", () => {
            renderCard()

            openModal()

            expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["opencode", "Claude Code", "Codex"])
            const dialog = screen.getByTestId("ai-connect")
            expect(dialog).toHaveTextContent("brew install anomalyco/tap/opencode-v2")
            expect(dialog).toHaveTextContent("cd /ruta/a/pilas-bloques-mcp && npm install && npm run build")
            expect(dialog).toHaveTextContent("opencode mcp add --global pilas-bloques -- node /ruta/a/pilas-bloques-mcp/dist/src/index.js")
            expect(dialog).toHaveTextContent("Connect to Pilas Bloques")
            expect(dialog).toHaveTextContent(t("ai.connect.privacy"))
        })

        test.each([
            ["claude", "npm install -g @anthropic-ai/claude-code@latest", "claude mcp add --scope user pilas-bloques -- node"],
            ["codex", "npm install -g @openai/codex", "codex mcp add pilas-bloques -- node"]
        ])("has the commands of %s", (assistant, install, register) => {
            renderCard()
            openModal()

            fireEvent.click(screen.getByTestId(`ai-tab-${assistant}`))

            expect(screen.getByTestId("ai-connect")).toHaveTextContent(install)
            expect(screen.getByTestId("ai-connect")).toHaveTextContent(register)
            expect(screen.getByTestId("ai-connect")).not.toHaveTextContent("opencode mcp add")
        })

        test("writes the commands with the folder of the teacher and remembers it", () => {
            const view = renderCard()
            openModal()

            type("ai-folder", "/home/me/my tools/pilas-bloques-mcp")

            expect(screen.getByTestId("ai-connect")).toHaveTextContent("cd '/home/me/my tools/pilas-bloques-mcp' && npm install")
            expect(screen.getByTestId("ai-connect")).toHaveTextContent("-- node '/home/me/my tools/pilas-bloques-mcp/dist/src/index.js'")
            view.unmount()
            renderCard()
            openModal()
            expect(screen.getByTestId("ai-folder")).toHaveValue("/home/me/my tools/pilas-bloques-mcp")
        })

        test("copies a command", () => {
            renderCard()
            openModal()

            fireEvent.click(screen.getByTestId("ai-copy-register"))

            expect(copied).toEqual(["opencode mcp add --global pilas-bloques -- node /ruta/a/pilas-bloques-mcp/dist/src/index.js"])
        })

        test("needs a code to share", () => {
            renderCard()
            openModal()

            expect(screen.getByTestId("ai-share")).toBeDisabled()
        })

        test("connects and closes the guide", async () => {
            renderCard()
            openModal()

            share()
            expect(screen.getByTestId("ai-share")).toBeDisabled()
            accept()

            await gone("ai-connect")
            expect(FakeSocket.last.sent[0]).toMatchObject({ type: "hello", code: "ABCD2345" })
            expect(screen.getByTestId("ai-indicator")).toHaveTextContent("claude-code")
        })

        test.each([
            ["unreachable", () => FakeSocket.last.drop()],
            ["bad_code", () => { FakeSocket.last.open(); FakeSocket.last.receive({ type: "rejected", reason: "bad_code" }); FakeSocket.last.drop() }],
            ["busy", () => { FakeSocket.last.open(); FakeSocket.last.receive({ type: "rejected", reason: "busy" }); FakeSocket.last.drop() }],
            ["protocol", () => { FakeSocket.last.open(); FakeSocket.last.receive({ type: "rejected", reason: "protocol" }); FakeSocket.last.drop() }]
        ])("explains the error %s", (error, answer) => {
            renderCard()
            openModal()
            share()

            answer()

            expect(screen.getByTestId("ai-error")).toHaveTextContent(t(`ai.errors.${error}`, { port: 47800 }))
            expect(t(`ai.errors.${error}`)).not.toBe(`ai.errors.${error}`)
            expect(screen.getByTestId("ai-share")).not.toBeDisabled()
        })

        test("stops trying when the guide is closed", () => {
            renderCard()
            openModal()
            share()
            const socket = FakeSocket.last

            fireEvent.click(screen.getByTestId("ai-connect-close"))

            expect(socket.closed).toBe(true)
        })

        test("says that the connection was lost", () => {
            renderCard()
            openModal()
            share()
            accept()

            FakeSocket.last.drop()

            expect(screen.queryByTestId("ai-indicator")).toBeNull()
            expect(screen.getByTestId("ai-lost")).toHaveTextContent(t("ai.errors.lost"))
        })
    })

    describe("connected", () => {
        const connect = async () => {
            renderCard()
            openModal()
            share()
            accept()
            await gone("ai-connect")
            openMenu()
        }

        test("shows who it shares with and examples to copy", async () => {
            await connect()

            const menu = screen.getByRole("menu")
            expect(menu).toHaveTextContent(t("ai.menu.sharing", { client: "claude-code" }))
            expect(screen.queryByTestId("ai-menu-connect")).toBeNull()
            const examples = within(menu).getAllByTestId(/^ai-menu-example-/)
            expect(examples).toHaveLength(3)
            fireEvent.click(examples[0])
            expect(copied).toEqual([t("ai.examples.solve")])
        })

        test("stops sharing", async () => {
            await connect()

            fireEvent.click(screen.getByTestId("ai-menu-stop"))

            expect(FakeSocket.last.closed).toBe(true)
            expect(screen.queryByTestId("ai-indicator")).toBeNull()
        })
    })

    test("removes the starting blocks, keeping a version with them", () => {
        LocalStorage.saveCreatorChallenge(litaChallenge({ predefinedSolution: "<xml/>" }))
        renderCard()
        openMenu()

        fireEvent.click(screen.getByTestId("ai-menu-remove-initial"))

        expect("predefinedSolution" in LocalStorage.getCreatorChallenge()!).toBe(false)
        expect(LocalStorage.getCreatorVersions().some(version => version.challenge.predefinedSolution === "<xml/>")).toBe(true)
    })

    test("keeps the connection in the creator when the mode changes", async () => {
        renderComponent(<CreatorEditor />)
        fireEvent.click(await screen.findByTestId("ai-button"))
        fireEvent.click(screen.getByTestId("ai-menu-connect"))
        share()
        accept()
        await gone("ai-connect")

        fireEvent.click(screen.getByTestId("creator-mode-test"))

        // On narrow screens (jsdom) the test mode has tabs, and "try" unmounts the board options.
        fireEvent.click(await screen.findByTestId("creator-tab-try"))
        expect(screen.queryByTestId("ai-button")).toBeNull()
        expect(FakeSocket.instances).toHaveLength(1)
        expect(FakeSocket.last.closed).toBe(false)
        expect(screen.getByTestId("ai-indicator")).toBeInTheDocument()
        act(() => { FakeSocket.last.receive({ type: "request", id: "1", method: "get_challenge", params: {} }) })
        expect(FakeSocket.last.sent.find(message => message.id === "1")).toMatchObject({ ok: true })

        fireEvent.click(screen.getByTestId("creator-mode-editor"))
        expect(await screen.findByTestId("ai-button")).toBeInTheDocument()
        expect(FakeSocket.last.closed).toBe(false)
    })
})
