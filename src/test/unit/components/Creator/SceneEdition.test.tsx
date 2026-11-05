import { fireEvent, screen } from '@testing-library/react'
import { defaultChallenge, SerializedChallenge } from "../../../../components/serializedChallenge"
import { SceneEdition } from '../../../../components/creator/Editor/SceneEdition/SceneEdition';
import { LocalStorage } from '../../../../localStorage';
import { renderWithContext } from '../../../testUtils';

// The +/- buttons were replaced by the size picker (see GridSizePicker.test.tsx).
const pickSize = async (rows: number, columns: number) => {
    fireEvent.click(await screen.findByTestId('grid-size-button'))
    fireEvent.click((await screen.findAllByTestId('grid-size-square'))[(rows - 1) * 8 + (columns - 1)])
}

describe('Scene Edition', () => {
    afterEach(() => {
        localStorage.clear()
    })

    beforeEach(() => {
        localStorage.clear()
        LocalStorage.saveCreatorChallenge(defaultChallenge("Lita"))
    })

    const getAmountFromChallenge = async (id: string) => await screen.getAllByTestId(`challenge-${id}`).length

    const getGridSize = async () => {

        const rows = await getAmountFromChallenge('row')
        const columns = await getAmountFromChallenge('cell') / rows

        return {rows, columns}
    }

    test("increment cols and rows to challenge map", async () => {
  
        renderWithContext(<SceneEdition />)

        await pickSize(4, 4)

        expect((await getGridSize()).rows).toBe(4)
        expect((await getGridSize()).columns).toBe(4)
    })
 
    test("decrement cols and rows to challenge map", async () => {
  
        renderWithContext(<SceneEdition />)

        await pickSize(2, 2)

        expect((await getGridSize()).rows).toBe(2)
        expect((await getGridSize()).columns).toBe(2)
    })

    test("decrement a col and check if actor changes to [0,0] challenge map cell", async () => {

        let challenge: SerializedChallenge = {
            ...defaultChallenge("Duba"),
            scene: {
                type: "Duba",
                maps: [[["-","-","-","-","-"],["-","-","-","-","A"],["-","-","-","-","-"]]]
            }
        }
    
        LocalStorage.saveCreatorChallenge(challenge)
      
        renderWithContext(<SceneEdition />)

        await pickSize(3, 4)

        expect((await getGridSize()).columns).toBe(4)
        expect((LocalStorage.getCreatorChallenge())?.scene.maps[0][0][0].includes("A")).toBeTruthy()
    })



})
