import { entryPointType } from "../../blockly/mulang/blockUtils"
import { MOVE_TO_PREFIX } from "./grid"
import { Program, Statement } from "./types"

const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const statementXml = (statement: Statement, next: string): string => {
    switch (statement.kind) {
        case 'action': {
            if (!statement.block.startsWith(MOVE_TO_PREFIX))
                return `<block type="${escape(statement.block)}">${next}</block>`
            const value = statement.block.slice(MOVE_TO_PREFIX.length)
            return `<block type="MoverA"><value name="direccion"><block type="${escape(value)}"></block></value>${next}</block>`
        }
        case 'call':
            return `<block type="procedures_callnoreturn"><mutation name="${escape(statement.name)}"></mutation>${next}</block>`
        case 'repeat':
            return `<block type="Repetir"><value name="count"><block type="math_number"><field name="NUM">${statement.times}</field></block></value>` +
                `<statement name="block">${chain(statement.body)}</statement>${next}</block>`
    }
}

/** Each block holds the following one inside <next>, as its last child. */
const chain = (statements: Statement[]): string =>
    statements.reduceRight((next, statement, i) => {
        const block = statementXml(statement, next)
        return i ? `<next>${block}</next>` : block
    }, '')

/** The program as the XML a Blockly workspace loads. */
export const programToXml = ({ main, procedures }: Program): string => {
    const definitions = procedures.map(({ name, body }, i) =>
        `<block type="procedures_defnoreturn" x="360" y="${15 + 220 * i}"><field name="NAME">${escape(name)}</field>` +
        `<statement name="STACK">${chain(body)}</statement></block>`)

    return '<xml xmlns="https://developers.google.com/blockly/xml">' +
        `<block type="${entryPointType}" x="15" y="15"><statement name="program">${chain(main)}</statement></block>` +
        definitions.join('') +
        '</xml>'
}
