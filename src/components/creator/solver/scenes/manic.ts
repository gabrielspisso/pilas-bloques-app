import { SceneModel, allDoneOrGone, planOnePerObject } from "../sceneModel"

/** Engine: EscenaManic. Repaired telescopes stay; observed stars and planets fly away. */
const won: SceneModel['won'] = state => ['T', 'E', 'P'].every(letter => allDoneOrGone(state, letter))

export const manicModel: SceneModel = {
    type: 'Manic',
    letters: ['T', 'E', 'P'],
    actions: {
        RepararTelescopio: { letter: 'T', effect: 'markOnce' },
        ObservarEstrella: { letter: 'E', effect: 'markOnce' },
        ObservarPlaneta: { letter: 'P', effect: 'markOnce' }
    },
    won,
    planTasks: (grid, toolbox) =>
        planOnePerObject(won, { T: 'RepararTelescopio', E: 'ObservarEstrella', P: 'ObservarPlaneta' })(grid, toolbox)
}
