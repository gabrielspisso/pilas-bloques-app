import { SerializedChallenge, defaultChallenge } from "../../../../../components/serializedChallenge"

export const LITA_MAP = [
    ["A", "O", "-", "O", "L"],
    ["-", "O", "O", "-", "-"],
    ["-", "O", "O", "-", "O"],
    ["-", "-", "-", "-", "-"],
    ["E", "O", "O", "O", "T"]
]

export const LITA_TOOLBOX = ["MoverACasillaDerecha", "MoverACasillaAbajo", "MoverACasillaIzquierda", "MoverACasillaArriba",
    "AgarrarTomate", "AgarrarLechuga", "PrepararEnsalada", "Repetir"]

export const litaChallenge = (changes: Partial<SerializedChallenge> = {}): SerializedChallenge => ({
    ...defaultChallenge("Lita", "Prepare the salad", "Salad"),
    scene: { type: "Lita", maps: [LITA_MAP] },
    toolbox: { blocks: LITA_TOOLBOX },
    ...changes
})

export const procedureName = (number: number) => `procedure ${number}`
