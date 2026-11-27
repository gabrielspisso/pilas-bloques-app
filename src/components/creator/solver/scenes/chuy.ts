import { SceneModel, allDoneOrGone, hasNothingToDo, none, taskCollector } from "../sceneModel"

/** Engine: EscenaChuy. Paddles do not count for victory. */
const won: SceneModel['won'] = state =>
    none(state, 'U') && none(state, 'P') && allDoneOrGone(state, 'G') && none(state, 'T')

const MANDATORY: Record<string, string> = { T: 'RecogerTrofeo', U: 'PatearPulpito', G: 'PatearPelotaChuy' }

export const chuyModel: SceneModel = {
    type: 'Chuy',
    letters: ['T', 'E', 'U', 'P', 'G'],
    actions: {
        RecogerTrofeo: { letter: 'T', effect: 'remove' },
        RecogerPaleta: { letter: 'E', effect: 'remove' },
        PatearPulpito: { letter: 'U', effect: 'remove' },
        PatearPelotaChuy: { letter: 'G', effect: 'markOnce' },
        RebotarPingPong: { letter: 'P', effect: 'remove' },
        // The only ping pong block the creator offers: it calls a function this scene does not have.
        RebotarUnaVezPingPong: { letter: 'P', effect: 'remove', engineError: true }
    },
    sensors: { HayTrofeo: 'T', TocandoPaleta: 'E', TocandoPulpito: 'U', TocandoPingPong: 'P', TocandoPelotaChuy: 'G' },
    vanishing: ['G'],
    won,
    planTasks: (grid, toolbox) => {
        if (hasNothingToDo(grid, won)) return { kind: 'nothingToDo' }

        const pingPong = grid.objects.filter(({ letter }) => letter === 'P')
        if (pingPong.length && !toolbox.includes('RebotarPingPong'))
            return { kind: 'engineLimitation', id: 'pingPong', cells: pingPong.map(({ cell }) => cell) }

        const collector = taskCollector(toolbox)
        const skippedPaddles = toolbox.includes('RecogerPaleta') ? [] : grid.objects.filter(({ letter }) => letter === 'E')
        grid.objects.forEach(({ cell, letter }) => {
            if (letter === 'P') collector.add(cell, 'RebotarPingPong')
            else if (letter === 'E') { if (!skippedPaddles.length) collector.add(cell, 'RecogerPaleta') }
            else collector.add(cell, MANDATORY[letter])
        })
        return collector.result(skippedPaddles.length
            ? [{ id: 'paddleNotRequired', cells: skippedPaddles.map(({ cell }) => cell) }]
            : [])
    }
}
