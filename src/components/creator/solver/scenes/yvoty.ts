import { SceneModel, allDoneOrGone, hasNothingToDo, none, taskCollector } from "../sceneModel"

/**
 * Engine: EscenaYvoty. Cellphones are solved either by unlocking them all (they disappear) or by
 * charging the remaining ones once no charger is left on the board.
 */
const won: SceneModel['won'] = state =>
    allDoneOrGone(state, 'L') && none(state, 'M') &&
    (none(state, 'C') || (allDoneOrGone(state, 'C') && none(state, 'K')))

export const yvotyModel: SceneModel = {
    type: 'Yvoty',
    letters: ['C', 'K', 'L', 'M'],
    actions: {
        DespertarLuciernaga: { letter: 'L', effect: 'markOnce' },
        FotografiarMariposa: { letter: 'M', effect: 'remove' },
        DesbloquearCelular: { letter: 'C', effect: 'remove' },
        AgarrarCargador: { letter: 'K', effect: 'remove' },
        CargarCelular: { letter: 'C', effect: 'markOnce', extraCheck: state => none(state, 'K') ? null : 'chargersLeft' }
    },
    won,
    planTasks: (grid, toolbox) => {
        if (hasNothingToDo(grid, won)) return { kind: 'nothingToDo' }

        // Unlocking is preferred; charging only when it is the single cellphone block offered.
        const hasCellphones = grid.objects.some(({ letter }) => letter === 'C')
        const unlock = toolbox.includes('DesbloquearCelular')
        const charge = hasCellphones && !unlock && toolbox.includes('CargarCelular')
        const cellphoneAction = charge ? 'CargarCelular' : 'DesbloquearCelular'
        const optionalChargers = !charge && !toolbox.includes('AgarrarCargador')

        const collector = taskCollector(toolbox)
        const chargerTasks: number[] = []
        const chargingTasks: number[] = []
        grid.objects.forEach(({ cell, letter }) => {
            if (letter === 'L') collector.add(cell, 'DespertarLuciernaga')
            else if (letter === 'M') collector.add(cell, 'FotografiarMariposa')
            else if (letter === 'C') {
                const task = collector.add(cell, cellphoneAction)
                if (task !== null && charge) chargingTasks.push(task)
            } else if (letter === 'K' && !optionalChargers) {
                const task = collector.add(cell, 'AgarrarCargador')
                if (task !== null) chargerTasks.push(task)
            }
        })
        chargingTasks.forEach(task => { collector.tasks[task].after = chargerTasks })

        // Chargers can only be skipped when the cellphones do not need them (or there are none).
        const skipped = optionalChargers && (unlock || !hasCellphones) ? grid.objects.filter(({ letter }) => letter === 'K') : []
        return collector.result(skipped.length ? [{ id: 'chargerNotRequired', cells: skipped.map(({ cell }) => cell) }] : [])
    }
}
