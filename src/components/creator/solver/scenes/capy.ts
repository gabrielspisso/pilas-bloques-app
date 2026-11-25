import { SceneModel, allDoneOrGone, planOnePerObject } from "../sceneModel"

/**
 * Engine: EscenaCapy. Cans and papers shrink away after being picked up, and picking one twice is
 * treated as an error (the engine's own check has a typo; the solver never does it anyway).
 */
const won: SceneModel['won'] = state => allDoneOrGone(state, 'L') && allDoneOrGone(state, 'P')

export const capyModel: SceneModel = {
    type: 'Capy',
    letters: ['L', 'P'],
    actions: {
        RecogerLata: { letter: 'L', effect: 'markOnce' },
        RecogerPapel: { letter: 'P', effect: 'markOnce' }
    },
    won,
    planTasks: (grid, toolbox) => planOnePerObject(won, { L: 'RecogerLata', P: 'RecogerPapel' })(grid, toolbox)
}
