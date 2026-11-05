import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { SceneGrid } from '../../../../components/creator/Editor/SceneEdition/Grid/SceneGrid'
import { MissionCard } from '../../../../components/creator/Editor/SceneEdition/MissionCard'
import { missionFor } from '../../../../components/creator/sceneGoals'
import { EMPTY } from '../../../../components/creator/Editor/SceneEdition/mapUtils'

describe('Mission card', () => {
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge('Lita')))
    afterEach(() => localStorage.clear())

    const renderWithTool = async (tool: string) => {
        render(<I18nextProvider i18n={i18n}>
            <CreatorContextProvider defaultSelectedTool={tool}>
                <MissionCard />
                <SceneGrid />
            </CreatorContextProvider>
        </I18nextProvider>)
        await screen.findByTestId('mission-card')
    }
    const cell = (n: number) => screen.getAllByTestId('challenge-cell')[n]

    test('missionFor counts goal objects, also under the actor, in goal order', () => {
        expect(missionFor('Lita', [['A&T', 'E'], ['T', '-']])).toEqual([
            { key: 'tomato', cell: 'T', count: 2 },
            { key: 'salad', cell: 'E', count: 1 }
        ])
        expect(missionFor('Lita', [['A', 'O']])).toEqual([])
    })

    test('shows the empty message when there are no objects', async () => {
        await renderWithTool('T')
        expect(screen.getByTestId('mission-empty')).toBeInTheDocument()
    })

    test('names the tomato and the salad bowl with their icons and updates when they are removed', async () => {
        await renderWithTool('T')
        fireEvent.click(cell(1))
        expect(screen.getByTestId('mission-goal-T')).toHaveTextContent(/tomate/i)
        expect(screen.getByTestId('mission-goal-T').querySelector('img')!.getAttribute('src')).toBe('imagenes/sceneImages/Lita/T.png')
        expect(screen.queryByTestId('mission-goal-E')).toBeNull()
        expect(screen.queryByTestId('mission-empty')).toBeNull()
    })

    test('disappears from the mission when the object is erased', async () => {
        LocalStorage.saveCreatorChallenge({ ...defaultChallenge('Lita'), scene: { type: 'Lita', maps: [[['A', 'E', '-']]] } })
        await renderWithTool(EMPTY)
        expect(screen.getByTestId('mission-goal-E')).toHaveTextContent(/ensalada/i)
        fireEvent.click(cell(1))
        expect(screen.queryByTestId('mission-goal-E')).toBeNull()
        expect(screen.getByTestId('mission-empty')).toBeInTheDocument()
    })
})
