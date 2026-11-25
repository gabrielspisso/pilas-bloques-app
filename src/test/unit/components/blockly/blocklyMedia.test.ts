import Blockly from 'blockly/core'
import { BLOCKLY_MEDIA_PATH, setupBlockly } from '../../../../components/blockly/blockly'

describe('Blockly media files', () => {
    test('are loaded from the app itself, not from the external default host', () => {
        const inject = jest.spyOn(Blockly, 'inject').mockImplementation(() => ({ addChangeListener: jest.fn() }) as any)

        setupBlockly(document.createElement('div'), { trashcan: true })

        expect(BLOCKLY_MEDIA_PATH).toBe('libs/blockly-media/')
        expect(inject).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ media: BLOCKLY_MEDIA_PATH, trashcan: true }))
        inject.mockRestore()
    })
})
