import { fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '../../../../i18n'
import { LocalStorage } from '../../../../localStorage'
import { LoadChallengeButton } from '../../../../components/creator/ActorSelection/LoadChallenge'
import { embedChallenge } from '../../../../components/creator/challengePng'
import { defaultChallenge, SerializedChallenge } from '../../../../components/serializedChallenge'
import { MINIMAL_PNG } from '../../../helpers/minimalPng'

const challenge: SerializedChallenge = { ...defaultChallenge('Lita'), title: 'Ensalada desde una imagen' }

describe('Open a created challenge from the character selection', () => {
    beforeAll(() => i18n.loadNamespaces(['creator', 'home']))
    afterEach(() => localStorage.clear())

    const upload = async (file: unknown) => {
        render(<MemoryRouter initialEntries={['/']}>
            <I18nextProvider i18n={i18n}>
                <Routes>
                    <Route path="/" element={<LoadChallengeButton />} />
                    <Route path="/creador/editar" element={<div data-testid="editor" />} />
                </Routes>
            </I18nextProvider>
        </MemoryRouter>)
        fireEvent.change(await screen.findByTestId('import-input'), { target: { files: [file] } })
    }

    const png = (bytes: Uint8Array) => new File([bytes], 'desafio.png', { type: 'image/png' })

    test('accepts .dpbq and .png files', async () => {
        render(<MemoryRouter><I18nextProvider i18n={i18n}><LoadChallengeButton /></I18nextProvider></MemoryRouter>)
        const accept = (await screen.findByTestId('import-input')).getAttribute('accept')!
        expect(accept).toContain('.dpbq')
        expect(accept).toContain('.png')
    })

    test('opens in the editor the challenge stored in an exported PNG', async () => {
        await upload(png(embedChallenge(MINIMAL_PNG, challenge)))
        expect(await screen.findByTestId('editor')).toBeInTheDocument()
        expect(LocalStorage.getCreatorChallenge()).toEqual(challenge)
    })

    test('still opens a .dpbq file', async () => {
        await upload({ name: 'viejo.dpbq', type: '', text: () => Promise.resolve(JSON.stringify(challenge)) })
        expect(await screen.findByTestId('editor')).toBeInTheDocument()
        expect(LocalStorage.getCreatorChallenge()).toEqual(challenge)
    })

    test('explains that an image has no challenge inside', async () => {
        await upload(png(MINIMAL_PNG))
        expect(await screen.findByTestId('dialog-snackbar')).toHaveTextContent('no trae un desafío guardado')
        expect(LocalStorage.getCreatorChallenge()).toBeFalsy()
    })

    test('a file that is not JSON shows the invalid file message', async () => {
        await upload({ name: 'roto.dpbq', type: '', text: () => Promise.resolve('no json') })
        expect(await screen.findByTestId('dialog-snackbar')).toHaveTextContent('El archivo es inválido')
    })
})
