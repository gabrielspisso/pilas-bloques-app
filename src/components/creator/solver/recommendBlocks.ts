import { availableBlocksFor } from "../../blockly/blocks"
import { SerializedChallenge } from "../../serializedChallenge"
import { MOVES, MOVE_TO_PREFIX } from "./grid"
import { solveChallenge } from "./solveChallenge"
import { Program, Statement } from "./types"

/** The toolbox blocks a program is made of. */
export const usedBlocks = ({ main, procedures }: Program): string[] => {
    const inside = (statements: Statement[]): string[] => statements.flatMap(statement => {
        switch (statement.kind) {
            case 'action': return statement.block.startsWith(MOVE_TO_PREFIX)
                ? ['MoverA', statement.block.slice(MOVE_TO_PREFIX.length)]
                : [statement.block]
            case 'call': return []
            case 'repeat': return ['Repetir', ...inside(statement.body)]
            case 'if': return ['Si', statement.sensor, ...inside(statement.body)]
            case 'until': return ['Hasta', statement.sensor, ...inside(statement.body)]
        }
    })
    const used = [...inside(main), ...procedures.flatMap(({ body }) => inside(body))]
    if (procedures.length) used.push('Procedimiento')
    return Array.from(new Set(used))
}

/** Every block the creator offers for the character, keeping the choices the teacher already made. */
const candidateToolbox = ({ scene, toolbox }: SerializedChallenge) => {
    const chosen = toolbox.blocks
    const available = availableBlocksFor(scene.type).map(({ id }) => id).filter(id => {
        // A direction already covered with "Move to" does not need its own block.
        const direction = MOVES[id]
        if (direction && chosen.includes('MoverA') && chosen.some(value => MOVES[MOVE_TO_PREFIX + value] === direction)) return false
        // Charging cellphones instead of unlocking them is a choice about the activity.
        return !(id === 'DesbloquearCelular' && chosen.includes('CargarCelular') && !chosen.includes(id))
    })
    return Array.from(new Set([...chosen, ...available]))
}

/**
 * The blocks missing from the toolbox to build the solution the solver finds when it can use every
 * block of the character, aiming at the active assessments. Empty when nothing can be solved.
 */
export const recommendedMissingBlocks = (challenge: SerializedChallenge, scenarioIndex: number, procedureName: (n: number) => string): string[] => {
    const everything = { ...challenge, toolbox: { ...challenge.toolbox, blocks: candidateToolbox(challenge) } }
    const result = solveChallenge(everything, scenarioIndex, procedureName)
    if (result.kind !== 'solved') return []
    return usedBlocks(result.program).filter(block => !challenge.toolbox.blocks.includes(block))
}
