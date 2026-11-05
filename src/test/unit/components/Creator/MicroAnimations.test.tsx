import { fireEvent, screen } from "@testing-library/react"
import { createTheme } from "@mui/material"
import { readFileSync } from "fs"
import { join } from "path"
import { renderComponent } from "../../../testUtils"
import { LocalStorage } from "../../../../localStorage"
import { defaultChallenge } from "../../../../components/serializedChallenge"
import { CreatorContextProvider } from "../../../../components/creator/Editor/CreatorContext"
import { SceneGrid } from "../../../../components/creator/Editor/SceneEdition/Grid/SceneGrid"
import { SceneDragProvider } from "../../../../components/creator/Editor/SceneEdition/SceneDrag"
import { MAX_TRANSITION_MS, getCreatorDesignTokens } from "../../../../theme/creatorTheme"

const css = readFileSync(join(__dirname, "../../../../components/creator/Editor/SceneEdition/Grid/grid.module.css"), "utf8")

describe("micro-animations", () => {
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge("Lita")))
    afterEach(() => localStorage.clear())

    test("a newly placed piece pops in, the pieces that were already there do not", async () => {
        renderComponent(<CreatorContextProvider defaultSelectedTool="T"><SceneDragProvider><SceneGrid styling={{}} /></SceneDragProvider></CreatorContextProvider>)
        const cells = await screen.findAllByRole("gridcell")
        fireEvent.click(cells[1])

        const images = screen.getAllByTestId("challenge-cell-image")
        const tomato = images.find(image => image.getAttribute("src")!.endsWith("/T.png"))!
        const actor = images.find(image => image.getAttribute("src")!.endsWith("/A.png"))!
        expect(tomato.className).toContain("piece-pop")
        expect(actor.className).not.toContain("piece-pop")
    })

    test("every CSS animation and transition of the board lasts less than 250 ms", () => {
        const durations = Array.from(css.matchAll(/(?:animation|transition):[^;]*?(\d+)ms/g)).map(match => Number(match[1]))
        expect(durations.length).toBeGreaterThan(0)
        durations.forEach(duration => expect(duration).toBeLessThan(250))
    })

    test("reduced motion turns the board animations off", () => {
        const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"))
        expect(reduced).toContain(".piece-pop, .ghost-pop { animation: none; }")
        expect(reduced).toContain(".cell { transition: none; }")
    })

    test("creator MUI transitions are short, and none with reduced motion", () => {
        const quick = createTheme(getCreatorDesignTokens(false, false, false))
        Object.values(quick.transitions.duration).forEach(duration => expect(duration).toBeLessThanOrEqual(MAX_TRANSITION_MS))
        const reduced = createTheme(getCreatorDesignTokens(false, false, true))
        expect(reduced.transitions.create("opacity")).toBe("none")
        expect(reduced.components?.MuiButtonBase?.defaultProps?.disableRipple).toBe(true)
    })
})
