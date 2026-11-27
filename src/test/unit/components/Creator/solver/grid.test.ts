import { moveOptions, parseMap } from "../../../../../components/creator/solver/grid"
import { MOVES4 } from "./helpers"

describe("parseMap", () => {
    test("reads the start, obstacles, missing cells and objects", () => {
        const grid = parseMap([["A", "O", "-"], ["_", "P", "-"]])
        expect(grid.rows).toBe(2)
        expect(grid.columns).toBe(3)
        expect(grid.start).toEqual({ row: 0, column: 0 })
        expect(grid.obstacle[0][1]).toBe(true)
        expect(grid.exists[1][0]).toBe(false)
        expect(grid.objects).toEqual([{ cell: { row: 1, column: 1 }, letter: 'P' }])
    })

    test("an object can share the cell with the actor", () => {
        expect(parseMap([["A&P"]]).objects).toEqual([{ cell: { row: 0, column: 0 }, letter: 'P' }])
    })

    test("needs exactly one actor", () => {
        expect(() => parseMap([["A", "A"]])).toThrow()
        expect(() => parseMap([["-", "P"]])).toThrow()
        expect(() => parseMap([])).toThrow()
    })
})

describe("moveOptions", () => {
    test("one token per direction", () => {
        expect(moveOptions(MOVES4).map(m => m.token))
            .toEqual(['MoverACasillaDerecha', 'MoverACasillaAbajo', 'MoverACasillaIzquierda', 'MoverACasillaArriba'])
    })

    test("'Move to' only offers the directions whose value is in the toolbox", () => {
        expect(moveOptions(['MoverA', 'ParaLaDerecha', 'ParaAbajo'])).toEqual([
            { direction: 'right', token: 'MoverA:ParaLaDerecha' },
            { direction: 'down', token: 'MoverA:ParaAbajo' }
        ])
    })

    test("the single movement block wins over 'Move to'", () => {
        expect(moveOptions(['MoverACasillaDerecha', 'MoverA', 'ParaLaDerecha']))
            .toEqual([{ direction: 'right', token: 'MoverACasillaDerecha' }])
    })
})
