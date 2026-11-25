import { SceneModel, none, planOnePerObject } from "../sceneModel"

/** Engine: EscenaDuba. */
const won: SceneModel['won'] = state => none(state, 'P')

export const dubaModel: SceneModel = {
    type: 'Duba',
    letters: ['P'],
    actions: {
        ComerChurrasco: { letter: 'P', effect: 'remove' }
    },
    sensors: { HayChurrasco: 'P' },
    vanishing: [],
    won,
    planTasks: (grid, toolbox) => planOnePerObject(won, { P: 'ComerChurrasco' })(grid, toolbox)
}
