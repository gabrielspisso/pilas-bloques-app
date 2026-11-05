import { fireEvent, render, screen } from '@testing-library/react'
import { createTheme } from '@mui/material'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { ChallengeHeaderEdition, TITLE_MAX_LENGTH } from '../../../../components/creator/Editor/ChallengeDetailsEdition/ChallengeHeaderEdition'
import { ThemeContext } from '../../../../theme/ThemeContext'
import { setBlocklyTheme } from '../../../../theme/ThemeContext'

// Replaces the TitleEdition / StatementEdition dialog tests: title and statement are now edited in place.
describe('Challenge header (title, statement, clue)', () => {
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge('Lita')))
    afterEach(() => localStorage.clear())

    const saved = () => LocalStorage.getCreatorChallenge()!

    const renderHeader = async (isSmallScreen = false) => {
        render(<I18nextProvider i18n={i18n}>
            <ThemeContext.Provider value={{
                darkModeEnabled: false, setDarkModeEnabled: () => { }, simpleReadModeEnabled: false, setSimpleReadModeEnabled: () => { },
                theme: createTheme(), isSmallScreen, blocklyTheme: setBlocklyTheme(false)
            }}>
                <CreatorContextProvider>
                    <ChallengeHeaderEdition />
                </CreatorContextProvider>
            </ThemeContext.Provider>
        </I18nextProvider>)
        await screen.findByTestId('challenge-header')
    }

    test('renders the statement input without opening any dialog', async () => {
        await renderHeader()
        expect(screen.getByTestId('statement-input')).toBeTruthy()
        expect(screen.getByTestId('title-input')).toBeTruthy()
    })

    test('updates LocalStorage with the new statement as you type, and shows it in the preview', async () => {
        await renderHeader()
        fireEvent.change(screen.getByTestId('statement-input'), { target: { value: 'new **statement** description' } })
        expect(saved().statement.description).toEqual('new **statement** description')
        expect(screen.getByTestId('statement-preview')).toHaveTextContent(/new (\*\*)?statement(\*\*)? description/) // markdown is not rendered in jsdom here
    })

    test('autosaves the title, shows a counter and caps it at 80 characters', async () => {
        await renderHeader()
        fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'Prueba título' } })
        expect(saved().title).toBe('Prueba título')
        expect(screen.getByTestId('title-counter')).toHaveTextContent(`13/${TITLE_MAX_LENGTH}`)

        fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'x'.repeat(100) } })
        expect(saved().title.length).toBe(TITLE_MAX_LENGTH)
    })

    test('the clue is optional: the switch opens the field and closing it removes the clue', async () => {
        await renderHeader()
        expect(screen.queryByTestId('clue-input')).toBeNull()
        fireEvent.click(screen.getByRole('checkbox'))
        fireEvent.change(await screen.findByTestId('clue-input'), { target: { value: 'una pista' } })
        expect(saved().statement.clue).toBe('una pista')
        fireEvent.click(screen.getByRole('checkbox'))
        expect(saved().statement.clue).toBeUndefined()
    })

    test('on small screens it starts collapsed and can be expanded', async () => {
        await renderHeader(true)
        const toggle = screen.getByTestId('challenge-header-toggle')
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(toggle)
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })
})
