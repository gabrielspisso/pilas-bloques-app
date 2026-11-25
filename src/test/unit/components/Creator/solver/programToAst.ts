import { entryPointType } from "../../../../../components/blockly/mulang/blockUtils"
import { Program, Statement } from "../../../../../components/creator/solver/types"
import { application, entryPoint, muIf, muUntil, number, procedure, rawSequence, repeat } from "../../blockly/mulang/astFactories"

const toAst = (statement: Statement): any => {
    switch (statement.kind) {
        case 'action': {
            const [block, value] = statement.block.split(':')
            return value ? application(block, application(value)) : application(block)
        }
        case 'call': return application(statement.name)
        case 'repeat': return repeat(number(statement.times), ...statement.body.map(toAst))
        case 'if': return muIf(application(statement.sensor), ...statement.body.map(toAst))
        case 'until': return muUntil(application(statement.sensor), ...statement.body.map(toAst))
    }
}

export const programToAst = ({ main, procedures }: Program) => rawSequence([
    entryPoint(entryPointType, ...main.map(toAst)),
    ...procedures.map(p => procedure(p.name, [], ...p.body.map(toAst)))
])
