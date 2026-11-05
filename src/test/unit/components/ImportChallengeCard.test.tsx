import { screen, fireEvent, render } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '../../../i18n';
import { ImportChallengeCard } from '../../../components/home/ImportChallengeCard';
import { renderComponent } from '../../testUtils';
import { creatorVersion, defaultChallenge, SerializedChallenge } from '../../../components/serializedChallenge';
import { embedChallenge } from '../../../components/creator/challengePng';
import { MINIMAL_PNG } from '../../helpers/minimalPng';

// importChallenge fetches the scene cover for the Ember app; not needed here.
jest.mock('../../../emberCommunication', () => ({ Ember: { importChallenge: jest.fn() } }))

const challenge: SerializedChallenge = {
  ...defaultChallenge('Lita'),
  title: 'Desafío en una imagen',
  scene: { type: 'Lita', maps: [[['A', 'T'], ['-', 'E']]] },
  toolbox: { blocks: ['MoverACasillaDerecha'] }
}

const ImportedView = () => {
  const location = useLocation()
  return <div data-testid="imported-view">{JSON.stringify(location.state)}</div>
}

const renderWithRoutes = () => render(
  <MemoryRouter initialEntries={['/']}>
    <I18nextProvider i18n={i18n}>
      <Routes>
        <Route path="/" element={<ImportChallengeCard />} />
        <Route path="/desafioImportado" element={<ImportedView />} />
      </Routes>
    </I18nextProvider>
  </MemoryRouter>)

const pngFile = (bytes: Uint8Array, name = 'desafio.png') => new File([bytes], name, { type: 'image/png' })

const upload = async (file: unknown) => {
  const input = await screen.findByTestId('import-input')
  fireEvent.change(input, { target: { files: [file] } })
}

test('shows error snackbar when invalid file is uploaded', async () => {

  renderComponent(<ImportChallengeCard />)

  const input = await screen.findByTestId('import-input')

  const invalidFileMock = {
    text: () => JSON.stringify({pepita: "hola"})
  }

  fireEvent.change(input, { target: { files: [invalidFileMock] } });

  const errorSnackbar = await screen.findByTestId("dialog-snackbar")

  expect(errorSnackbar).toBeTruthy()

})

describe('import from .dpbq and .png', () => {
  beforeAll(() => i18n.loadNamespaces(['home']))

  test('accepts both file types', async () => {
    renderWithRoutes()
    const accept = (await screen.findByTestId('import-input')).getAttribute('accept')!
    expect(accept).toContain('.dpbq')
    expect(accept).toContain('.png')
  })

  test('an old .dpbq file still opens the challenge', async () => {
    renderWithRoutes()
    await upload({ name: 'viejo.dpbq', type: '', text: () => Promise.resolve(JSON.stringify(challenge)) })
    const view = await screen.findByTestId('imported-view')
    expect(JSON.parse(view.textContent!)).toEqual(challenge)
  })

  test('a .dpbq that is not JSON shows the invalid file message', async () => {
    renderWithRoutes()
    await upload({ name: 'roto.dpbq', type: '', text: () => Promise.resolve('no json') })
    expect(await screen.findByText(/el archivo es inválido/i)).toBeInTheDocument()
  })

  test('an exported PNG opens the same challenge', async () => {
    renderWithRoutes()
    await upload(pngFile(embedChallenge(MINIMAL_PNG, challenge)))
    const view = await screen.findByTestId('imported-view')
    expect(JSON.parse(view.textContent!)).toEqual(challenge)
  })

  test('a PNG without data says so', async () => {
    renderWithRoutes()
    await upload(pngFile(MINIMAL_PNG, 'foto.PNG'))
    expect(await screen.findByText(/no trae un desafío guardado/i)).toBeInTheDocument()
    expect(screen.queryByTestId('imported-view')).not.toBeInTheDocument()
  })

  test('a PNG from a newer version says so', async () => {
    renderWithRoutes()
    await upload(pngFile(embedChallenge(MINIMAL_PNG, { ...challenge, fileVersion: creatorVersion + 1 })))
    expect(await screen.findByText(/versión más nueva/i)).toBeInTheDocument()
  })

  test('a file named .png that is not a PNG is invalid', async () => {
    renderWithRoutes()
    await upload(new File([JSON.stringify(challenge)], 'trucho.png', { type: 'image/png' }))
    expect(await screen.findByText(/el archivo es inválido/i)).toBeInTheDocument()
  })
})
