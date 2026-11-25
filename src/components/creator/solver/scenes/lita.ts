import { SceneModel, hasNothingToDo, none, taskCollector } from "../sceneModel"

/**
 * Engine: EscenaLita. A salad can only be prepared once no ingredient is left on the whole board.
 * With salad bowls, one preparation is enough to win; without them, picking every ingredient is.
 */
const ingredientsGone = (state: Parameters<SceneModel['won']>[0]) => none(state, 'L') && none(state, 'T')

const won: SceneModel['won'] = state =>
    state.objects.some(({ letter }) => letter === 'E') ? !!state.flags.prepared : ingredientsGone(state)

const ACTIONS: Record<string, string> = { L: 'AgarrarLechuga', T: 'AgarrarTomate', E: 'PrepararEnsalada' }

export const litaModel: SceneModel = {
    type: 'Lita',
    letters: ['L', 'T', 'E'],
    actions: {
        AgarrarLechuga: { letter: 'L', effect: 'remove' },
        AgarrarTomate: { letter: 'T', effect: 'remove' },
        PrepararEnsalada: {
            letter: 'E',
            effect: 'markOnce',
            extraCheck: state => ingredientsGone(state) ? null : 'ingredientsLeft',
            onDone: state => { state.flags.prepared = true }
        }
    },
    sensors: { HayLechuga: 'L', HayTomate: 'T', HayEnsaladera: 'E' },
    vanishing: [],
    won,
    planTasks: (grid, toolbox) => {
        if (hasNothingToDo(grid, won)) return { kind: 'nothingToDo' }
        const collector = taskCollector(toolbox)
        const ingredients: number[] = []
        const bowls: number[] = []
        grid.objects.forEach(({ cell, letter }) => {
            const task = collector.add(cell, ACTIONS[letter])
            if (task !== null) (letter === 'E' ? bowls : ingredients).push(task)
        })
        // The mission asks to prepare every salad, after picking every ingredient.
        bowls.forEach(bowl => { collector.tasks[bowl].after = ingredients })
        return collector.result()
    }
}
