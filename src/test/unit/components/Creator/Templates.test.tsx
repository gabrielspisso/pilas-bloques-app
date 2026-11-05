import { fireEvent, screen } from "@testing-library/react"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { isValidChallenge } from "../../../../components/serializedChallenge"
import { challengeFromTemplate, challengeTemplates, templatesFor } from "../../../../components/creator/templates"
import { TemplatesButton } from "../../../../components/creator/ActorSelection/TemplatesButton"
import { availableBlocksFor } from "../../../../components/blockly/blocks"
import { publishChecklist } from "../../../../components/creator/publishChecklist"
import { hasActor } from "../../../../components/creator/Editor/SceneEdition/mapUtils"
import i18n from "../../../../i18n"

const mockNavigate = jest.fn()
jest.mock("react-router-dom", () => ({ ...jest.requireActual("react-router-dom"), useNavigate: () => mockNavigate }))

describe("challenge templates", () => {
    const characters = ["Lita", "Duba", "Chuy", "Manic", "Capy", "Yvoty"] as const

    test.each(characters)("%s has two or three templates", (type) => {
        expect(templatesFor(type).length).toBeGreaterThanOrEqual(2)
        expect(templatesFor(type).length).toBeLessThanOrEqual(3)
    })

    test.each(challengeTemplates.map(template => [template.id, template] as const))("%s is a valid, complete challenge", (_, template) => {
        const challenge = challengeFromTemplate(template, key => key)
        expect(isValidChallenge(challenge)).toBe(true)
        challenge.scene.maps.forEach(map => expect(map.flat().filter(hasActor)).toHaveLength(1))
        const available = availableBlocksFor(template.type).map(block => block.id)
        template.blocks.forEach(block => expect(available).toContain(block))
        expect(publishChecklist(challenge).every(item => item.ok)).toBe(true)
    })

    test("every template has its texts in the three languages", async () => {
        for (const language of ["es-ar", "en-us", "pt-br"]) {
            const texts = require(`../../../../../locales/${language}/creator.json`)
            challengeTemplates.forEach(template => {
                expect(texts.selection.templates[template.id].title).toBeTruthy()
                expect(texts.selection.templates[template.id].statement).toBeTruthy()
            })
        }
    })
})

describe("TemplatesButton", () => {
    beforeAll(() => i18n.loadNamespaces(["creator"]))
    afterEach(() => { localStorage.clear(); mockNavigate.mockClear() })

    test("choosing a template saves it as the draft and opens the editor", async () => {
        renderComponent(<TemplatesButton type="Lita" />)
        fireEvent.click(await screen.findByTestId("templates-button"))
        fireEvent.click(await screen.findByTestId("template-litaSalad"))

        const saved = LocalStorage.getCreatorChallenge()!
        expect(isValidChallenge(saved)).toBe(true)
        expect(saved.scene.maps).toEqual([[["A", "L", "T", "E"]]])
        expect(saved.title).toBe(i18n.t("selection.templates.litaSalad.title", { ns: "creator" }))
        expect(mockNavigate).toHaveBeenCalledWith("/creador/editar")
    })
})
