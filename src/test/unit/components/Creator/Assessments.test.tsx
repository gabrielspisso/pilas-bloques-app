import { fireEvent, screen } from "@testing-library/react"
import * as Blockly from "blockly/core"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { defaultChallenge, isValidChallenge } from "../../../../components/serializedChallenge"
import { CreatorContextProvider } from "../../../../components/creator/Editor/CreatorContext"
import { AssessmentsEdition } from "../../../../components/creator/Editor/ChallengeDetailsEdition/AssessmentsEdition"
import { assesmentsToGrading, clampProgramLength } from "../../../../components/creator/assessments"
import { expectationFor } from "../../../../components/blockly/mulang/challengeExpectations"
import i18n from "../../../../i18n"

const workspace = { getAllBlocks: () => [] } as unknown as Blockly.WorkspaceSvg

describe("assessments → Mulang expectations", () => {
    test("no assessments means no expectations and the final dialog on", () => {
        expect(assesmentsToGrading(undefined)).toEqual({ expectations: {}, maxProgramLength: undefined, hasAutomaticGrading: true })
    })

    test("each assessment maps to the expectation id the static challenges use", () => {
        const grading = assesmentsToGrading({ itWorks: false, simpleRepetition: true, conditionalRepetition: true, conditionalAlternative: false, decomposition: { maxProgramLength: 12 } })
        expect(grading).toEqual({
            expectations: { simpleRepetition: true, conditionalRepetition: true, decomposition: true },
            maxProgramLength: 12,
            hasAutomaticGrading: false
        })
    })

    test("expectationFor uses the configuration of a creator challenge (id 0)", () => {
        const challenge = { id: 0, ...assesmentsToGrading({ simpleRepetition: true }) }
        expect(expectationFor(challenge, workspace)).toContain("uses repeat")
        expect(expectationFor({ id: 0, ...assesmentsToGrading(undefined) }, workspace)).toBe("")
    })

    test("decomposition uses maxProgramLength instead of the fixed 7", () => {
        const custom = expectationFor({ id: 0, ...assesmentsToGrading({ decomposition: { maxProgramLength: 12 } }) }, workspace)
        expect(custom).toContain("<= 11")
        expect(custom).not.toContain("<= 6")
        const fallback = expectationFor({ id: 0, expectations: { decomposition: true } }, workspace)
        expect(fallback).toContain("<= 6")
    })

    test("the program length is kept in a sensible range", () => {
        expect(clampProgramLength(1)).toBe(2)
        expect(clampProgramLength(99)).toBe(30)
        expect(clampProgramLength(NaN)).toBe(7)
    })
})

describe("AssessmentsEdition", () => {
    beforeAll(() => i18n.loadNamespaces(["creator"]))
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge("Lita")))
    afterEach(() => localStorage.clear())

    const open = async () => {
        renderComponent(<CreatorContextProvider><AssessmentsEdition /></CreatorContextProvider>)
        fireEvent.click(await screen.findByTestId("assessments-button"))
    }

    test("'it works' is on by default and the rest off", async () => {
        await open()
        expect((screen.getByTestId("assessment-itWorks") as HTMLInputElement).checked).toBe(true)
        expect((screen.getByTestId("assessment-simpleRepetition") as HTMLInputElement).checked).toBe(false)
        expect((screen.getByTestId("assessment-decomposition") as HTMLInputElement).checked).toBe(false)
        expect((screen.getByTestId("assessment-max-length") as HTMLInputElement).disabled).toBe(true)
    })

    test("choices are saved in challenge.assesments and the file stays valid", async () => {
        await open()
        fireEvent.click(screen.getByTestId("assessment-simpleRepetition"))
        fireEvent.click(screen.getByTestId("assessment-decomposition"))
        fireEvent.change(screen.getByTestId("assessment-max-length"), { target: { value: "10" } })
        fireEvent.click(screen.getByTestId("assessment-itWorks"))

        const saved = LocalStorage.getCreatorChallenge()!
        expect(saved.assesments).toEqual({ itWorks: false, simpleRepetition: true, decomposition: { maxProgramLength: 10 } })
        expect(saved.fileVersion).toBe(1)
        expect(isValidChallenge(saved)).toBe(true)
    })

    test("turning decomposition off removes it", async () => {
        await open()
        fireEvent.click(screen.getByTestId("assessment-decomposition"))
        fireEvent.click(screen.getByTestId("assessment-decomposition"))
        expect(LocalStorage.getCreatorChallenge()!.assesments!.decomposition).toBeUndefined()
    })
})
