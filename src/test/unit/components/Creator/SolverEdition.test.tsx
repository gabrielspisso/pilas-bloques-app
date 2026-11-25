import { fireEvent, screen } from "@testing-library/react"
import { useContext } from "react"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { SceneType, defaultChallenge } from "../../../../components/serializedChallenge"
import { CreatorContext, CreatorContextProvider } from "../../../../components/creator/Editor/CreatorContext"
import { SolverEdition } from "../../../../components/creator/Editor/ChallengeDetailsEdition/SolverEdition"
import i18n from "../../../../i18n"
import { MOVES4, REPEAT } from "./solver/helpers"

const Probe = () => <div data-testid="probe">{useContext(CreatorContext).previewProgram?.xml}</div>

describe("SolverEdition", () => {
    beforeAll(() => i18n.loadNamespaces(["creator", "blocks"]))
    afterEach(() => localStorage.clear())

    const open = async (type: SceneType, maps: string[][][], blocks: string[]) => {
        LocalStorage.saveCreatorChallenge({ ...defaultChallenge('Duba'), scene: { type, maps }, toolbox: { blocks } })
        renderComponent(<CreatorContextProvider><SolverEdition /><Probe /></CreatorContextProvider>)
        fireEvent.click(await screen.findByTestId("solver-button"))
    }

    const line = [["A", "-", "-", "P"]]

    test("shows the solution and loads it into the preview", async () => {
        await open('Duba', [line], [...MOVES4, 'ComerChurrasco', REPEAT])
        const result = await screen.findByTestId("solver-result")
        expect(result).toHaveTextContent("3 bloques")
        expect(result).toHaveTextContent("no garantiza ser la más corta")
        const program = screen.getByTestId("solution-program")
        expect(program).toHaveTextContent("Repetir 3 veces")
        expect(program).toHaveTextContent("Mover a la derecha")

        fireEvent.click(screen.getByTestId("solver-try"))
        expect(screen.getByTestId("probe").textContent).toContain('type="Repetir"')
        expect(LocalStorage.getCreatorChallenge()!.predefinedSolution).toBeUndefined()
    })

    test("names the missing blocks", async () => {
        await open('Duba', [line], MOVES4)
        expect(await screen.findByTestId("solver-error")).toHaveTextContent("Comer churrasco")
        expect(screen.queryByTestId("solver-try")).toBeNull()
    })

    test("says which cells cannot be reached", async () => {
        await open('Duba', [[["A", "O", "P"]]], [...MOVES4, 'ComerChurrasco'])
        expect(await screen.findByTestId("solver-error")).toHaveTextContent("fila 1, columna 3")
    })

    test("a character without a solver", async () => {
        await open('Chuy', [[["A", "T"]]], MOVES4)
        expect(await screen.findByTestId("solver-error")).toHaveTextContent("Todavía no se pueden calcular soluciones para Chuy")
    })
})
