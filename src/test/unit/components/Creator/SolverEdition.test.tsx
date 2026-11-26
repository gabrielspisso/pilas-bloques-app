import { fireEvent, screen } from "@testing-library/react"
import { useContext } from "react"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { Assesments, SceneType, defaultChallenge } from "../../../../components/serializedChallenge"
import { CreatorContext, CreatorContextProvider } from "../../../../components/creator/Editor/CreatorContext"
import { SolverEdition } from "../../../../components/creator/Editor/ChallengeDetailsEdition/SolverEdition"
import i18n from "../../../../i18n"
import { MOVES4, REPEAT } from "./solver/helpers"

const Probe = () => <div data-testid="probe">{useContext(CreatorContext).previewProgram?.xml}</div>

describe("SolverEdition", () => {
    beforeAll(() => i18n.loadNamespaces(["creator", "blocks"]))
    afterEach(() => localStorage.clear())

    const open = async (type: SceneType, maps: string[][][], blocks: string[], assesments?: Assesments) => {
        LocalStorage.saveCreatorChallenge({ ...defaultChallenge('Duba'), scene: { type, maps }, toolbox: { blocks }, assesments })
        renderComponent(<CreatorContextProvider><SolverEdition /><Probe /></CreatorContextProvider>)
        fireEvent.click(await screen.findByTestId("solver-button"))
    }

    const line = [["A", "-", "-", "P"]]

    test("shows the solution and loads it into the preview", async () => {
        await open('Duba', [line], [...MOVES4, 'ComerChurrasco', REPEAT])
        const result = await screen.findByTestId("solver-result")
        expect(result).toHaveTextContent("3 bloques")
        expect(result).toHaveTextContent("no garantiza ser la más corta")
        expect(result).toHaveTextContent("no significa que cumpla con tu criterio como docente")
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
        await open('Custom', [[["A", "-"]]], MOVES4)
        expect(await screen.findByTestId("solver-error")).toHaveTextContent("Todavía no se pueden calcular soluciones")
    })

    test("explains why Chuy cannot bounce ping pong balls", async () => {
        await open('Chuy', [[["A", "P"]]], [...MOVES4, 'RebotarUnaVezPingPong'])
        const error = await screen.findByTestId("solver-error")
        expect(error).toHaveTextContent("ping pong")
        expect(error).toHaveTextContent("fila 1, columna 2")
    })

    const lettuce = [[["A", "L", "-"]], [["A", "-", "L"]]]
    const conditional = [...MOVES4, 'AgarrarLechuga', 'Si', 'HayLechuga']

    test("shows one program for every scenario, with its conditions", async () => {
        await open('Lita', lettuce, conditional, { conditionalAlternative: true })
        const result = await screen.findByTestId("solver-result")
        expect(result).toHaveTextContent("Un mismo programa resuelve los 2 escenarios")
        expect(screen.getByTestId("solution-program")).toHaveTextContent("Si ¿Hay lechuga acá?")
        expect(screen.getByTestId("solver-scenarios")).toHaveTextContent("Escenario 2: la resuelve")
        expect(screen.queryByTestId("solver-warnings")).toBeNull()

        fireEvent.click(screen.getByTestId("solver-try"))
        expect(screen.getByTestId("probe").textContent).toContain('type="Si"')
    })

    test("names the blocks a common program needs", async () => {
        await open('Lita', lettuce, [...MOVES4, 'AgarrarLechuga'])
        expect(await screen.findByTestId("solver-result")).toHaveTextContent("Escenario 2: no la resuelve")
        expect(screen.getByTestId("solver-notes")).toHaveTextContent("hacen falta en la caja: Si, ¿Hay lechuga acá?")
    })

    test("explains why there is no conditional alternative with one scenario", async () => {
        await open('Lita', [lettuce[0]], conditional, { conditionalAlternative: true })
        const warnings = await screen.findByTestId("solver-warnings")
        expect(warnings).toHaveTextContent("No usa la alternativa condicional. Con este tablero no hay nada que decidir")
    })

    test("shows a 'Repeat until' and its note", async () => {
        await open('Duba', [line], [...MOVES4, 'ComerChurrasco', 'Hasta', 'BordeDerecho'], { conditionalRepetition: true })
        await screen.findByTestId("solver-result")
        expect(screen.getByTestId("solution-program")).toHaveTextContent("Repetir hasta que")
        expect(screen.getByTestId("solver-notes")).toHaveTextContent("Con un solo escenario")
    })

    test("adds the recommended blocks to an empty toolbox and solves", async () => {
        await open('Duba', [line], ['MoverA'])
        const recommended = await screen.findByTestId("solver-recommended")
        expect(recommended).toHaveTextContent("Comer churrasco")
        expect(screen.getByTestId("solver-error")).toBeInTheDocument()

        fireEvent.click(screen.getByTestId("solver-add-blocks"))

        expect(await screen.findByTestId("solver-result")).toHaveTextContent("3 bloques")
        expect(screen.queryByTestId("solver-recommended")).toBeNull()
        expect(LocalStorage.getCreatorChallenge()!.toolbox.blocks)
            .toEqual(['MoverA', 'Repetir', 'MoverACasillaDerecha', 'ComerChurrasco'])
    })
})
