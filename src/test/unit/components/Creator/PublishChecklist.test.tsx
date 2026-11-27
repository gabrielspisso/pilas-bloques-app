import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../../i18n'
import { defaultChallenge, SerializedChallenge } from '../../../../components/serializedChallenge'
import { LocalStorage } from '../../../../localStorage'
import { CreatorContextProvider } from '../../../../components/creator/Editor/CreatorContext'
import { ShareButtons } from '../../../../components/creator/Editor/ActionButtons/ShareChallenge/ShareModalButtons'
import { ChallengeHeaderEdition } from '../../../../components/creator/Editor/ChallengeDetailsEdition/ChallengeHeaderEdition'
import { publishChecklist } from '../../../../components/creator/publishChecklist'

const complete: SerializedChallenge = {
    ...defaultChallenge('Lita'),
    title: 'Prueba ensalada',
    statement: { description: 'Prepará la ensalada' },
    scene: { type: 'Lita', maps: [[['A', 'T'], ['-', 'E']]] },
    toolbox: { blocks: ['MoverACasillaDerecha'] }
}

describe('Publish checklist', () => {
    afterEach(() => localStorage.clear())

    test('publishChecklist rules', () => {
        const ok = (c: SerializedChallenge | null, defaults = {}) => publishChecklist(c, defaults).map(i => `${i.id}:${i.ok}`)
        expect(ok(complete)).toEqual(['title:true', 'statement:true', 'goals:true', 'blocks:true'])
        expect(ok({ ...complete, title: '   ' })[0]).toBe('title:false')
        expect(ok(complete, { title: 'Prueba ensalada' })[0]).toBe('title:false') // still the default text
        expect(ok({ ...complete, scene: { type: 'Lita', maps: [[['A', 'T']], [['A', 'O']]] } })[2]).toBe('goals:false') // 2nd scenario has no goal
        expect(ok({ ...complete, toolbox: { blocks: [] } })[3]).toBe('blocks:false')
        expect(ok(null).every(i => i.endsWith('false'))).toBe(true)
    })

    const renderShare = async () => {
        LocalStorage.saveUser({ id: 'u', token: 't', nickName: 'docente', avatarURL: '', answeredQuestionIds: [] })
        render(<I18nextProvider i18n={i18n}>
            <CreatorContextProvider>
                <ChallengeHeaderEdition />
                <ShareButtons />
            </CreatorContextProvider>
        </I18nextProvider>)
        await screen.findByTestId('publish-checklist')
    }

    test('share is disabled and explains what is missing; completing the title enables it', async () => {
        LocalStorage.saveCreatorChallenge({ ...complete, title: '' })
        await renderShare()
        expect(screen.getByTestId('checklist-title')).toHaveAttribute('data-ok', 'false')
        expect(screen.getByTestId('upsertButton')).toBeDisabled()
        expect(screen.getByTestId('checklist-status')).toHaveTextContent(/título/i)

        fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'Prueba ensalada' } })
        expect(screen.getByTestId('checklist-title')).toHaveAttribute('data-ok', 'true')
        expect(screen.getByTestId('upsertButton')).not.toBeDisabled()
    })

    test('a new challenge lists everything as missing', async () => {
        LocalStorage.saveCreatorChallenge(defaultChallenge('Lita', i18n.t('creator:statement.defaultDescription')!, i18n.t('creator:statement.defaultTitle')!))
        await renderShare()
        for (const id of ['title', 'statement', 'goals', 'blocks'])
            expect(screen.getByTestId(`checklist-${id}`)).toHaveAttribute('data-ok', 'false')
        expect(screen.getByTestId('upsertButton')).toBeDisabled()
    })
})
