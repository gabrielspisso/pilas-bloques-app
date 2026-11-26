import { availableBlocksFor } from "../../blockly/blocks"
import { SceneType, sceneObjectByType } from "../../serializedChallenge"
import { GRID_LIMITS } from "../Editor/SceneEdition/mapUtils"
import { modelFor } from "../solver/sceneModel"
import { MAX_LEVELS, MAX_STATEMENTS, MAX_TIMES, programBlocks } from "./parseProgram"

export const MAX_TITLE_LENGTH = 200
export const MAX_TEXT_LENGTH = 2000

const OBJECTS: Partial<Record<SceneType, Record<string, string>>> = {
    Lita: { L: 'lettuce', T: 'tomato', E: 'salad bowl' },
    Duba: { P: 'steak (churrasco)' },
    Manic: { T: 'telescope', E: 'star', P: 'planet' },
    Yvoty: { C: 'cellphone', K: 'charger', L: 'firefly', M: 'butterfly' },
    Capy: { L: 'can', P: 'paper' },
    Chuy: { T: 'trophy', E: 'paddle', U: 'rubber ball (pulpito)', P: 'ping pong ball', G: 'soccer ball' }
}

// Taken from the rules in solver/scenes/*.ts, which mirror the engine.
const VICTORY: Partial<Record<SceneType, string>> = {
    Lita: 'With salad bowls on the board, preparing one salad wins, but a salad can only be prepared once no lettuce or tomato is left on the whole board. Without salad bowls, picking every ingredient wins.',
    Duba: 'Eat every steak.',
    Capy: 'Pick up every can and every paper. Each one is picked once; its sensor is not reliable afterwards.',
    Manic: 'Repair every telescope and observe every star and planet, each one once. Observed stars and planets fly away: their sensors are not reliable afterwards.',
    Yvoty: 'Wake up every firefly and photograph every butterfly. For cellphones, either unlock them all, or charge them all after picking up every charger.',
    Chuy: 'Collect every trophy, kick every rubber ball and every soccer ball. Paddles do not count. A board with a ping pong ball cannot be solved with the blocks the creator offers (its only ping pong block fails in the game), so do not use the letter P.'
}

const RULES = 'Moving onto an obstacle or out of the board fails, as does acting on a cell without the right object or acting twice on the same one. An obstacle sensor fails when there is no cell in that direction. "until" repeats its body while the sensor is false.'

export const catalogFor = (type: SceneType, blockName: (id: string) => string) => {
    const model = modelFor(type)
    const known = programBlocks(type)
    const objects = OBJECTS[type] ?? {}
    const letterOf = (block: string) => {
        if (model && Object.prototype.hasOwnProperty.call(model.actions, block)) return { actsOn: model.actions[block].letter }
        if (model && Object.prototype.hasOwnProperty.call(model.sensors, block)) return { detects: model.sensors[block] }
        return {}
    }

    return {
        /** Every block the creator offers for the character: the possible toolbox. */
        blocks: availableBlocksFor(type).map(({ id, categoryId }) => ({ id, name: blockName(id), category: categoryId, ...letterOf(id) })),
        /** What a program can use. "MoverA:<value>" needs the blocks "MoverA" and <value> in the toolbox. */
        programActions: known?.actions ?? [],
        programSensors: known?.sensors ?? [],
        movementTokens: known?.actions.filter(action => action.startsWith('Mover')) ?? [],
        programFormat: `{"main": [...], "procedures": [{"name", "body"}]}. Statements: {"kind":"action","block"}, {"kind":"call","name"} (needs the block "Procedimiento"), {"kind":"repeat","times","body"} (block "Repetir"), {"kind":"if","sensor","body"} (block "Si" and the sensor), {"kind":"until","sensor","body"} (block "Hasta" and the sensor).`,
        mapLetters: {
            A: 'the character (exactly one per scenario)',
            O: 'obstacle',
            '-': 'empty cell',
            ...Object.fromEntries(sceneObjectByType(type).validCells.map(letter => [letter, objects[letter] ?? letter])),
            'A&X': 'the character standing on the object X'
        },
        victory: VICTORY[type] ?? 'The simulator does not support this character.',
        rules: RULES,
        limits: {
            ...GRID_LIMITS, titleLength: MAX_TITLE_LENGTH, textLength: MAX_TEXT_LENGTH,
            statements: MAX_STATEMENTS, levels: MAX_LEVELS, times: MAX_TIMES
        }
    }
}
