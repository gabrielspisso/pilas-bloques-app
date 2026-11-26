import { act, screen, waitFor } from "@testing-library/react"
import { useContext } from "react"
import { renderComponent } from "../../../../testUtils"
import { LocalStorage } from "../../../../../localStorage"
import { SerializedChallenge, defaultChallenge } from "../../../../../components/serializedChallenge"
import { CreatorContext, CreatorContextProvider, CreatorContextType } from "../../../../../components/creator/Editor/CreatorContext"
import { CreatorLivePreview, useChallengeInMemory } from "../../../../../components/creator/Editor/CreatorLivePreview"
import i18n from "../../../../../i18n"

let mockMounts: string[]

// Like the real one, it reads the starting blocks only when it mounts.
jest.mock("../../../../../components/challengeView/ChallengeView", () => {
    const { useState } = jest.requireActual("react")
    return {
        ChallengeView: ({ serializedChallenge }: { serializedChallenge: SerializedChallenge }) => {
            const [blocks] = useState(() => {
                mockMounts.push(serializedChallenge.predefinedSolution ?? '')
                return serializedChallenge.predefinedSolution ?? ''
            })
            return <div data-testid="challenge-view-mock" data-blocks={blocks} />
        }
    }
})

let context: CreatorContextType
let inMemory: SerializedChallenge

const Probe = () => {
    context = useContext(CreatorContext)
    inMemory = useChallengeInMemory()
    return null
}

const renderDraft = () => renderComponent(<CreatorContextProvider><Probe /><CreatorLivePreview /></CreatorContextProvider>)
const stored = () => LocalStorage.getCreatorChallenge()!
const shownBlocks = () => screen.getByTestId("challenge-view-mock").getAttribute("data-blocks")

describe("The starting blocks of the student in the draft", () => {
    // Otherwise the first render suspends while the translations load.
    beforeAll(() => i18n.loadNamespaces(["creator"]))
    beforeEach(() => {
        mockMounts = []
        LocalStorage.saveCreatorChallenge(defaultChallenge("Duba"))
    })
    afterEach(() => localStorage.clear())

    test("are saved and available in memory", () => {
        renderDraft()

        act(() => context.setInitialSolution("<xml>start</xml>"))

        expect(context.initialSolution).toBe("<xml>start</xml>")
        expect(stored().predefinedSolution).toBe("<xml>start</xml>")
        expect(inMemory.predefinedSolution).toBe("<xml>start</xml>")
    })

    test("can be removed", () => {
        LocalStorage.saveCreatorChallenge({ ...defaultChallenge("Duba"), predefinedSolution: "<xml>start</xml>" })
        renderDraft()
        expect(context.initialSolution).toBe("<xml>start</xml>")

        act(() => context.setInitialSolution(undefined))

        expect("predefinedSolution" in stored()).toBe(false)
        expect("predefinedSolution" in inMemory).toBe(false)
    })

    test("come back when a challenge is loaded", () => {
        renderDraft()

        act(() => context.loadChallenge({ ...defaultChallenge("Duba"), predefinedSolution: "<xml>old</xml>" }))
        expect(stored().predefinedSolution).toBe("<xml>old</xml>")

        act(() => context.loadChallenge(defaultChallenge("Duba")))
        expect("predefinedSolution" in stored()).toBe(false)
    })

    test("reload the preview when they change", async () => {
        renderDraft()
        await waitFor(() => expect(shownBlocks()).toBe(""))

        act(() => context.setInitialSolution("<xml>start</xml>"))

        await waitFor(() => expect(shownBlocks()).toBe("<xml>start</xml>"))
        expect(mockMounts).toEqual(["", "<xml>start</xml>"])
    })

    test("do not replace a program sent to the preview", async () => {
        renderDraft()
        act(() => context.setPreviewProgram({ xml: "<xml>program</xml>", id: 1 }))
        await waitFor(() => expect(shownBlocks()).toBe("<xml>program</xml>"))

        act(() => context.setInitialSolution("<xml>start</xml>"))
        await waitFor(() => expect(inMemory.predefinedSolution).toBe("<xml>start</xml>"))
        await act(() => new Promise(resolve => setTimeout(resolve, 600)))

        expect(shownBlocks()).toBe("<xml>program</xml>")
        expect(mockMounts.filter(blocks => blocks === "<xml>program</xml>")).toHaveLength(1)
        expect(stored().predefinedSolution).toBe("<xml>start</xml>")
    })
})
