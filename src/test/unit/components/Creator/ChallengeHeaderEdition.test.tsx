import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createTheme } from '@mui/material'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { defaultChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import {
    ChallengeHeaderEdition, TITLE_MAX_LENGTH, HEADER_ROW_HEIGHT_PX, TITLE_FONT_SIZE_PX,
    collapsedHeaderHeight, shouldShowTitleCounter, statementSummary
} from '../../../../components/creator/Editor/ChallengeDetailsEdition/ChallengeHeaderEdition'
import { ThemeContext } from '../../../../theme/ThemeContext'
import { setBlocklyTheme } from '../../../../theme/ThemeContext'

describe('Compact header sizes and helpers', () => {
    test('collapsed it is one low row: <= 64 px on desktop (and <= 8% of an 800 px window), <= 48 px on mobile', () => {
        expect(collapsedHeaderHeight(false)).toBeLessThanOrEqual(64)
        expect(collapsedHeaderHeight(false)).toBeLessThanOrEqual(800 * 0.08)
        expect(collapsedHeaderHeight(true)).toBeLessThanOrEqual(48)
        expect(HEADER_ROW_HEIGHT_PX.mobile).toBeGreaterThanOrEqual(44) // still a touch target
    })

    test('the title uses a normal-large font (18 to 22 px)', () => {
        for (const size of Object.values(TITLE_FONT_SIZE_PX)) {
            expect(size).toBeGreaterThanOrEqual(18)
            expect(size).toBeLessThanOrEqual(22)
        }
    })

    test('the counter shows only while focused or when few characters are left', () => {
        expect(shouldShowTitleCounter(10, false)).toBe(false)
        expect(shouldShowTitleCounter(10, true)).toBe(true)
        expect(shouldShowTitleCounter(TITLE_MAX_LENGTH - 10, false)).toBe(true)
        expect(shouldShowTitleCounter(TITLE_MAX_LENGTH - 11, false)).toBe(false)
    })

    test('the statement summary is one plain-text line', () => {
        expect(statementSummary('Así se verá tu **enunciado**...')).toBe('Así se verá tu enunciado...')
        expect(statementSummary('# Título\n- uno\n- [dos](http://x)\n\n![img](a.png)')).toBe('Título uno dos')
        expect(statementSummary('   ')).toBe('')
    })
})

describe('Challenge header (title, statement, clue)', () => {
    beforeEach(() => LocalStorage.saveCreatorChallenge(defaultChallenge('Lita', 'Así se verá tu **enunciado**...')))
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

    const expand = () => fireEvent.click(screen.getByTestId('challenge-header-toggle'))

    test.each([false, true])('starts collapsed in one row with a statement summary (small screen: %s)', async (small) => {
        await renderHeader(small)
        const toggle = screen.getByTestId('challenge-header-toggle')
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByTestId('statement-summary')).toHaveTextContent('Así se verá tu enunciado...')
        expect(screen.queryByTestId('statement-input')).toBeNull()
        expect(screen.queryByTestId('statement-preview')).toBeNull() // no side preview anymore
        expect(screen.getByTestId('title-input')).toBeTruthy()
    })

    test('the title has an accessible label and help text', async () => {
        await renderHeader()
        const input = screen.getByTestId('title-input')
        expect(input.getAttribute('aria-describedby')).toContain('challenge-title-help')
        expect(document.querySelector('label[for="challenge-title-input"]')).not.toBeNull()
        expect(input.id).toBe('challenge-title-input')
    })

    test('autosaves the title, caps it at 80 characters and shows the counter only when focused or near the limit', async () => {
        await renderHeader()
        const counter = screen.getByTestId('title-counter')
        expect(counter.style.visibility).toBe('hidden')

        fireEvent.focus(screen.getByTestId('title-input'))
        fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'Prueba título' } })
        expect(saved().title).toBe('Prueba título')
        expect(counter).toHaveTextContent(`13/${TITLE_MAX_LENGTH}`)
        expect(counter.style.visibility).toBe('visible')

        fireEvent.blur(screen.getByTestId('title-input'))
        expect(counter.style.visibility).toBe('hidden')

        fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'x'.repeat(100) } })
        expect(saved().title.length).toBe(TITLE_MAX_LENGTH)
        expect(counter.style.visibility).toBe('visible')
    })

    test('expanding shows the statement input; it autosaves and the preview tab shows it', async () => {
        await renderHeader()
        expand()
        expect(screen.getByTestId('challenge-header-toggle')).toHaveAttribute('aria-expanded', 'true')
        fireEvent.change(await screen.findByTestId('statement-input'), { target: { value: 'new **statement** description' } })
        expect(saved().statement.description).toEqual('new **statement** description')
        expect(screen.getByTestId('statement-summary')).toHaveTextContent('new statement description')

        fireEvent.click(screen.getByTestId('statement-tab-preview'))
        expect(screen.queryByTestId('statement-input')).toBeNull()
        expect(screen.getByTestId('statement-preview')).toHaveTextContent(/new (\*\*)?statement(\*\*)? description/)
        fireEvent.click(screen.getByTestId('statement-tab-write'))
        expect(screen.getByTestId('statement-input')).toBeTruthy()
    })

    test('the panel closes with its button and with Escape, giving focus back to the toggle', async () => {
        await renderHeader()
        expand()
        fireEvent.click(await screen.findByTestId('statement-panel-close'))
        expect(screen.getByTestId('challenge-header-toggle')).toHaveAttribute('aria-expanded', 'false')
        await waitFor(() => expect(screen.queryByTestId('statement-input')).toBeNull())

        expand()
        fireEvent.keyDown(await screen.findByTestId('statement-input'), { key: 'Escape' })
        expect(screen.getByTestId('challenge-header-toggle')).toHaveAttribute('aria-expanded', 'false')
        expect(document.activeElement).toBe(screen.getByTestId('challenge-header-toggle'))
    })

    test('the clue is optional and lives inside the panel: the switch opens the field and closing it removes the clue', async () => {
        await renderHeader()
        expect(screen.queryByTestId('clue-switch')).toBeNull()
        expand()
        expect(screen.queryByTestId('clue-input')).toBeNull()
        fireEvent.click(await screen.findByRole('checkbox'))
        fireEvent.change(await screen.findByTestId('clue-input'), { target: { value: 'una pista' } })
        expect(saved().statement.clue).toBe('una pista')
        fireEvent.click(screen.getByRole('checkbox'))
        expect(saved().statement.clue).toBeUndefined()
    })

    test('tab order: title, then the statement toggle, then the panel fields', async () => {
        await renderHeader()
        expand()
        await screen.findByTestId('statement-input')
        const order = Array.from(document.querySelectorAll<HTMLElement>('input, textarea, button'))
            .filter(element => element.tabIndex >= 0)
            .map(element => element.getAttribute('data-testid') || element.id)
        expect(order.indexOf('title-input')).toBeLessThan(order.indexOf('challenge-header-toggle'))
        expect(order.indexOf('challenge-header-toggle')).toBeLessThan(order.indexOf('statement-input'))
    })
})
