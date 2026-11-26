import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { useContext } from "react"
import { renderComponent } from "../../../../testUtils"
import i18n from "../../../../../i18n"
import { LocalStorage } from "../../../../../localStorage"
import { CreatorContext, CreatorContextProvider, CreatorContextType } from "../../../../../components/creator/Editor/CreatorContext"
import { AiSession, AiSessionProvider, useAiSession } from "../../../../../components/creator/ai/AiSessionProvider"
import { solveChallenge } from "../../../../../components/creator/solver/solveChallenge"
import { SolverSuccess } from "../../../../../components/creator/solver/types"
import { LITA_MAP, LITA_TOOLBOX, litaChallenge, procedureName } from "./fixtures"
import { FakeSocket, installFakeSocket } from "./fakeSocket"

let session: AiSession
let draft: CreatorContextType

const Probe = () => {
    session = useAiSession()
    draft = useContext(CreatorContext)
    return null
}

const renderSession = () => renderComponent(<CreatorContextProvider><AiSessionProvider><Probe /></AiSessionProvider></CreatorContextProvider>)

const connect = () => {
    act(() => session.connect(" abcd2345 "))
    const socket = FakeSocket.last
    socket.open()
    socket.receive({ type: "welcome", client: "claude-code" })
    return socket
}

const stored = () => LocalStorage.getCreatorChallenge()!
const solution = (solveChallenge(litaChallenge(), 0, procedureName) as SolverSuccess).program
const propose = (socket: FakeSocket, changes: unknown, summary = "My proposal") => socket.request("propose_changes", { summary, changes })
const status = (socket: FakeSocket, proposalId: string) => socket.request("get_proposal_status", { proposalId }).result.status

describe("AI session", () => {
    installFakeSocket()
    beforeAll(() => i18n.loadNamespaces(["creator", "blocks"]))
    beforeEach(() => LocalStorage.saveCreatorChallenge(litaChallenge({ sharedId: "shared-1" })))
    afterEach(() => localStorage.clear())

    describe("connection", () => {
        test("connects to the local server and sends the code", () => {
            renderSession()
            expect(session.status).toBe("disconnected")

            act(() => session.connect(" abcd2345 "))

            expect(session.status).toBe("connecting")
            expect(FakeSocket.last.url).toBe("ws://127.0.0.1:47800")
            FakeSocket.last.open()
            expect(FakeSocket.last.sent).toEqual([{ type: "hello", protocol: 1, code: "ABCD2345" }])
        })

        test("is connected after the welcome", () => {
            renderSession()

            connect()

            expect(session.status).toBe("connected")
            expect(session.client).toBe("claude-code")
        })

        test.each(["bad_code", "busy", "protocol"])("explains a rejection: %s", reason => {
            renderSession()
            act(() => session.connect("X"))
            FakeSocket.last.open()

            FakeSocket.last.receive({ type: "rejected", reason })
            FakeSocket.last.drop()

            expect(session.status).toBe("disconnected")
            expect(session.error).toBe(reason)
        })

        test("says when nothing answers on the port", () => {
            renderSession()
            act(() => session.connect("X"))

            FakeSocket.last.drop()

            expect(session.status).toBe("disconnected")
            expect(session.error).toBe("unreachable")
        })

        test("notices that the server left", () => {
            renderSession()
            const socket = connect()

            socket.drop()

            expect(session.status).toBe("disconnected")
            expect(session.error).toBe("lost")
        })

        test("says goodbye when the teacher stops sharing", () => {
            renderSession()
            const socket = connect()

            act(() => session.disconnect())

            expect(socket.sent[socket.sent.length - 1]).toEqual({ type: "bye" })
            expect(socket.closed).toBe(true)
            expect(session.status).toBe("disconnected")
            expect(session.error).toBeUndefined()
        })

        test("closes the connection when the creator closes", () => {
            const view = renderSession()
            const socket = connect()

            view.unmount()

            expect(socket.closed).toBe(true)
        })

        test("ignores a connection it already replaced", () => {
            renderSession()
            act(() => session.connect("A"))
            const old = FakeSocket.last
            const socket = connect()

            old.drop()

            expect(old.closed).toBe(true)
            expect(session.status).toBe("connected")
            expect(socket.closed).toBe(false)
        })

        test("ignores messages it does not understand", () => {
            renderSession()
            const socket = connect()

            socket.receive("not json")
            socket.receive({ type: "other" })
            socket.receive(null)

            expect(session.status).toBe("connected")
        })

        test("does not answer requests before the welcome", () => {
            renderSession()
            act(() => session.connect("X"))
            FakeSocket.last.open()

            expect(FakeSocket.last.request("get_challenge")).toBeUndefined()
        })
    })

    describe("requests", () => {
        test("answers with the current draft", () => {
            renderSession()
            const socket = connect()
            act(() => draft.setTitle("A new title"))

            const response = socket.request("get_challenge")

            expect(response).toMatchObject({ type: "response", ok: true, result: { character: "Lita", title: "A new title" } })
            expect(response.result.catalog.blocks.find((block: any) => block.id === "AgarrarTomate").name).not.toBe("AgarrarTomate")
        })

        test("tests programs and recommends solutions", () => {
            renderSession()
            const socket = connect()

            expect(socket.request("test_program", { program: solution }).result.scenarios).toEqual([{ index: 0, solved: true }])
            expect(socket.request("get_recommended_solution").result.kind).toBe("solved")
        })

        test("fails an unknown method", () => {
            renderSession()
            const socket = connect()

            expect(socket.request("delete_everything")).toMatchObject({ ok: false, error: { code: "unknown_method" } })
        })

        test("does not send an answer the server would not accept", () => {
            LocalStorage.saveCreatorChallenge(litaChallenge({ predefinedSolution: "x".repeat(256 * 1024) }))
            renderSession()
            const socket = connect()

            expect(socket.request("get_challenge")).toMatchObject({ ok: false, error: { code: "too_large" } })
        })
    })

    describe("proposals", () => {
        const changes = { title: "New title", description: "New description" }

        test("shows a valid proposal and changes nothing", () => {
            renderSession()
            const socket = connect()
            const before = stored()

            const { result } = propose(socket, changes)

            expect(result).toEqual({ proposalId: expect.any(String), status: "pending" })
            expect(screen.getByTestId("ai-proposal")).toHaveTextContent("My proposal")
            expect(stored()).toEqual(before)
            expect(status(socket, result.proposalId)).toBe("pending")
            expect(status(socket, "other")).toBe("unknown")
        })

        test("returns the errors of an invalid one", () => {
            renderSession()
            const socket = connect()

            const { result } = propose(socket, { sharedId: "x" })

            expect(result.errors).toHaveLength(1)
            expect(screen.queryByTestId("ai-proposal")).toBeNull()
        })

        test("needs a summary", () => {
            renderSession()
            const socket = connect()

            expect(propose(socket, changes, " ").result.errors).toHaveLength(1)
        })

        test("accepts one at a time", () => {
            renderSession()
            const socket = connect()
            propose(socket, changes)

            expect(propose(socket, { title: "Other" })).toMatchObject({ ok: false, error: { code: "proposal_pending" } })
        })

        test("applies only the proposed fields", async () => {
            renderSession()
            const socket = connect()
            const before = stored()
            const { proposalId } = propose(socket, changes).result

            fireEvent.click(screen.getByTestId("ai-proposal-apply"))

            expect(stored()).toEqual({ ...before, title: "New title", statement: { description: "New description" } })
            expect(status(socket, proposalId)).toBe("applied")
            await waitFor(() => expect(screen.queryByTestId("ai-proposal")).toBeNull())
        })

        test("applies a whole level", () => {
            renderSession()
            const socket = connect()
            act(() => draft.setIndex(0))
            const map = [["A", "L", "E"]]
            propose(socket, {
                clue: "A clue", maps: [map, map], toolbox: [...LITA_TOOLBOX, "Procedimiento"],
                assesments: { simpleRepetition: true }, initialProgram: { main: [], procedures: [] },
                previewProgram: { main: [{ kind: "action", block: "MoverACasillaDerecha" }], procedures: [] }
            })

            fireEvent.click(screen.getByTestId("ai-proposal-apply"))

            expect(stored()).toMatchObject({
                sharedId: "shared-1", title: "Salad", scene: { type: "Lita", maps: [map, map] },
                statement: { description: "Prepare the salad", clue: "A clue" },
                toolbox: { blocks: [...LITA_TOOLBOX, "Procedimiento"], categorized: true },
                assesments: { simpleRepetition: true }
            })
            expect(stored().predefinedSolution).toContain("<xml")
            expect(draft.previewProgram!.xml).toContain("MoverACasillaDerecha")
            expect(draft.index).toBe(0)
        })

        test("can undo the boards it applies", () => {
            renderSession()
            const socket = connect()
            propose(socket, { maps: [[["A", "L"]]] })
            fireEvent.click(screen.getByTestId("ai-proposal-apply"))

            act(() => draft.undo())

            expect(stored().scene.maps).toEqual([LITA_MAP])
        })

        test("keeps a version of the draft as it was, even if edited right before", () => {
            renderSession()
            const socket = connect()
            act(() => draft.setTitle("Edited by the teacher"))
            propose(socket, changes)

            fireEvent.click(screen.getByTestId("ai-proposal-apply"))

            const titles = LocalStorage.getCreatorVersions().map(version => version.challenge.title)
            expect(titles.slice(-2)).toEqual(["Edited by the teacher", "New title"])
        })

        test("removes the starting blocks and the old preview program", () => {
            LocalStorage.saveCreatorChallenge(litaChallenge({ predefinedSolution: "<xml/>" }))
            renderSession()
            const socket = connect()
            act(() => draft.setPreviewProgram({ xml: "<xml>old</xml>", id: 1 }))
            propose(socket, { initialProgram: null })

            fireEvent.click(screen.getByTestId("ai-proposal-apply"))

            expect("predefinedSolution" in stored()).toBe(false)
            expect(draft.previewProgram).toBeNull()
        })

        test("changes nothing when rejected", async () => {
            renderSession()
            const socket = connect()
            const before = stored()
            const { proposalId } = propose(socket, { ...changes, maps: [[["A", "L"]]] }).result

            fireEvent.click(screen.getByTestId("ai-proposal-reject"))

            expect(stored()).toEqual(before)
            expect(status(socket, proposalId)).toBe("rejected")
            await waitFor(() => expect(screen.queryByTestId("ai-proposal")).toBeNull())
            expect(propose(socket, changes).result.status).toBe("pending")
        })

        test("does not apply a proposal that stopped being valid", () => {
            renderSession()
            const socket = connect()
            const { proposalId } = propose(socket, { previewProgram: solution }).result
            act(() => draft.setToolbox({ blocks: [] }))

            expect(screen.getByTestId("ai-proposal-invalid")).toBeInTheDocument()
            expect(screen.getByTestId("ai-proposal-apply")).toBeDisabled()
            act(() => session.apply())
            expect(status(socket, proposalId)).toBe("pending")
        })

        test("is discarded when the teacher stops sharing", () => {
            renderSession()
            const socket = connect()
            propose(socket, changes)

            act(() => session.disconnect())

            expect(session.proposal).toBeUndefined()
        })
    })

    describe("review dialog", () => {
        test("shows before and after of every field", () => {
            renderSession()
            const socket = connect()
            propose(socket, { title: "New title", maps: [[["A", "-", "L"]]], toolbox: ["MoverACasillaDerecha", "AgarrarLechuga"] })

            const title = screen.getByTestId("ai-change-title")
            expect(title).toHaveTextContent("Salad")
            expect(title).toHaveTextContent("New title")
            expect(screen.getByTestId("ai-change-maps")).toHaveTextContent("A - L")
            expect(screen.getByTestId("ai-change-toolbox").textContent).not.toContain("AgarrarLechuga")
            expect(screen.queryByTestId("ai-change-clue")).toBeNull()
            expect(screen.getByTestId("ai-proposal-not-tested")).toBeInTheDocument()
        })

        test("shows the proposed texts as plain text", () => {
            renderSession()
            const socket = connect()
            const text = '<img src=x onerror="alert(1)"> **bold** [link](http://example.com)'
            propose(socket, { description: text, clue: text }, text)

            expect(screen.getByTestId("ai-change-description")).toHaveTextContent(text)
            expect(screen.getByTestId("ai-proposal").querySelectorAll("img, a, strong")).toHaveLength(0)
        })

        test("shows the program and that it solves the challenge", () => {
            renderSession()
            const socket = connect()

            propose(socket, { previewProgram: solution })

            expect(screen.getByTestId("ai-change-previewProgram").querySelector('[data-testid="solution-program"]')).not.toBeNull()
            expect(screen.getByTestId("ai-proposal-solved")).toBeInTheDocument()
            expect(screen.queryByTestId("ai-proposal-unsolved")).toBeNull()
        })

        test("warns when the program does not solve it, and still lets apply", () => {
            renderSession()
            const socket = connect()

            propose(socket, { previewProgram: { main: [], procedures: [] }, assesments: { simpleRepetition: true } })

            expect(screen.getByTestId("ai-proposal-unsolved")).toBeInTheDocument()
            expect(screen.getByTestId("ai-proposal-warnings")).toBeInTheDocument()
            expect(screen.getByTestId("ai-proposal-apply")).not.toBeDisabled()
        })

        test("tells that the student will start with the proposed blocks", () => {
            renderSession()
            const socket = connect()

            propose(socket, { initialProgram: { main: [], procedures: [] } })

            expect(screen.getByTestId("ai-change-initialProgram")).toHaveTextContent(i18n.t("ai.proposal.studentStarts", { ns: "creator" })!)
        })

        test("does not close without a decision", () => {
            renderSession()
            const socket = connect()
            propose(socket, { title: "New title" })

            fireEvent.keyDown(screen.getByTestId("ai-proposal"), { key: "Escape" })

            expect(session.proposal).toBeDefined()
        })
    })
})
