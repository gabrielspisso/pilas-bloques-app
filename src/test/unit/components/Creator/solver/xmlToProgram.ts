import { Procedure, Program, Statement } from "../../../../../components/creator/solver/types"

const child = (element: Element, tag: string, name?: string) =>
    Array.from(element.children).find(c => c.tagName === tag && (name === undefined || c.getAttribute('name') === name))

const required = (element: Element | undefined, what: string): Element => {
    if (!element) throw new Error(`Missing ${what}`)
    return element
}

const readBlock = (block: Element): Statement => {
    const type = block.getAttribute('type')!
    switch (type) {
        case 'Repetir':
        case 'repetir': {
            const count = required(child(block, 'value', 'count'), 'count')
            const number = required(child(count, 'block') ?? child(count, 'shadow'), 'number')
            return { kind: 'repeat', times: Number(required(child(number, 'field', 'NUM'), 'NUM').textContent), body: readStatement(block, 'block') }
        }
        case 'procedures_callnoreturn':
            return { kind: 'call', name: required(child(block, 'mutation'), 'mutation').getAttribute('name')! }
        case 'MoverA': {
            const value = required(child(required(child(block, 'value', 'direccion'), 'direccion'), 'block'), 'direction block')
            return { kind: 'action', block: `MoverA:${value.getAttribute('type')}` }
        }
        default:
            return { kind: 'action', block: type }
    }
}

const readChain = (first: Element | undefined): Statement[] => {
    const statements: Statement[] = []
    for (let block = first; block;) {
        statements.push(readBlock(block))
        const next = child(block, 'next')
        block = next && child(next, 'block')
    }
    return statements
}

const readStatement = (block: Element, name: string): Statement[] => {
    const statement = child(block, 'statement', name)
    return readChain(statement && child(statement, 'block'))
}

/** Reads the Blockly XML of a solution (variables and shadows without meaning are ignored). */
export const xmlToProgram = (xml: string): Program => {
    const document = new DOMParser().parseFromString(xml.trim(), 'text/xml')
    if (document.getElementsByTagName('parsererror').length) throw new Error('Invalid XML')
    let main: Statement[] = []
    const procedures: Procedure[] = []
    // Disabled blocks left aside in the workspace do not run.
    Array.from(document.documentElement.children).filter(c => c.tagName === 'block' && c.getAttribute('disabled') !== 'true').forEach(block => {
        const type = block.getAttribute('type')
        if (type === 'al_empezar_a_ejecutar') main = readStatement(block, 'program')
        else if (type === 'procedures_defnoreturn')
            procedures.push({ name: required(child(block, 'field', 'NAME'), 'NAME').textContent!, body: readStatement(block, 'STACK') })
        else throw new Error(`Unexpected top block ${type}`)
    })
    return { main, procedures }
}
