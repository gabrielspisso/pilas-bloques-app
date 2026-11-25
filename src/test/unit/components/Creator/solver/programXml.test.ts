import { programToXml } from "../../../../../components/creator/solver/programXml"
import { Program, Statement } from "../../../../../components/creator/solver/types"
import { xmlToProgram } from "./xmlToProgram"

const actions = (...blocks: string[]): Statement[] => blocks.map(block => ({ kind: 'action', block }))

describe("programToXml", () => {
    const programs: [string, Program][] = [
        ['a repetition', { main: [{ kind: 'repeat', times: 3, body: actions('MoverACasillaDerecha', 'ComerChurrasco') }, ...actions('MoverACasillaAbajo')], procedures: [] }],
        ['"Move to"', { main: actions('MoverA:ParaLaDerecha', 'ComerChurrasco', 'MoverA:ParaAbajo'), procedures: [] }],
        ['procedures', {
            main: [{ kind: 'call', name: 'Parte 1' }, ...actions('MoverACasillaAbajo'), { kind: 'call', name: 'Parte 1' }],
            procedures: [{ name: 'Parte 1', body: [{ kind: 'repeat', times: 2, body: actions('MoverACasillaDerecha') }] }]
        }],
        ['conditions', {
            main: [
                { kind: 'until', sensor: 'BordeDerecho', body: [...actions('MoverACasillaDerecha'), { kind: 'if', sensor: 'HayChurrasco', body: actions('ComerChurrasco') }] },
                ...actions('MoverACasillaAbajo')
            ],
            procedures: []
        }]
    ]

    test.each(programs)("round trip with %s", (_, program) => {
        const xml = programToXml(program)
        expect(new DOMParser().parseFromString(xml, 'text/xml').getElementsByTagName('parsererror')).toHaveLength(0)
        expect(xmlToProgram(xml)).toEqual(program)
    })

    test("escapes procedure names", () => {
        const name = 'a<b & "c"'
        const program: Program = { main: [{ kind: 'call', name }], procedures: [{ name, body: actions('ComerChurrasco') }] }
        const xml = programToXml(program)
        expect(xml).toContain('a&lt;b &amp; &quot;c&quot;')
        expect(xmlToProgram(xml)).toEqual(program)
    })
})
