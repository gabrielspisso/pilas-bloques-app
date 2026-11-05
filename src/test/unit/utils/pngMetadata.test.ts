import { asciiJson, crc32, encodeTextChunk, insertTextChunk, InvalidPngError, isPng, PNG_SIGNATURE, readChunks, readTextChunk } from '../../../utils/pngMetadata'
import { CHALLENGE_PNG_KEYWORD, embedChallenge, extractChallenge } from '../../../components/creator/challengePng'
import { creatorVersion, defaultChallenge, isValidChallenge, SerializedChallenge } from '../../../components/serializedChallenge'

import { MINIMAL_PNG } from '../../helpers/minimalPng'

const bytesOf = (s: string) => Uint8Array.from(Array.from(s).map(c => c.charCodeAt(0)))

const challenge: SerializedChallenge = {
    ...defaultChallenge('Lita'),
    title: 'Ensalada de año nuevo ñandú 🍅',
    statement: { description: 'Juntá **todo**\n\n"comillas" \\ barra', clue: 'Pista: ¿y si repetís?' },
    scene: { type: 'Lita', maps: [[['A', 'T'], ['O', 'E']], [['A&L', '-']]] },
    toolbox: { blocks: ['MoverACasillaDerecha', 'AgarrarTomate'], categorized: false },
    predefinedSolution: '<xml><block type="al_empezar_a_ejecutar"></block></xml>',
    assesments: { itWorks: true, decomposition: { maxProgramLength: 9 }, simpleRepetition: true },
    sharedId: 'abc123'
}

/** Every chunk must have a valid CRC and IEND must be last: a structural check of a PNG. */
const expectWellFormed = (png: Uint8Array) => {
    expect(isPng(png)).toBe(true)
    const chunks = readChunks(png)
    chunks.forEach(chunk => expect(chunk.crcOk).toBe(true))
    expect(chunks[0].type).toBe('IHDR')
    expect(chunks[chunks.length - 1].type).toBe('IEND')
    const last = chunks[chunks.length - 1]
    expect(last.offset + 12).toBe(png.length) // nothing after IEND
}

describe('PNG metadata (pure)', () => {
    test('crc32 matches the standard check value and the CRCs written by a real encoder', () => {
        expect(crc32(bytesOf('123456789'))).toBe(0xcbf43926)
        expect(crc32(new Uint8Array())).toBe(0)
        readChunks(MINIMAL_PNG).forEach(chunk => expect(chunk.crcOk).toBe(true))
    })

    test('reads the chunks of the minimal PNG', () => {
        expect(readChunks(MINIMAL_PNG).map(c => [c.type, c.data.length])).toEqual([['IHDR', 13], ['IDAT', 11], ['IEND', 0]])
        expectWellFormed(MINIMAL_PNG)
    })

    test('rejects what is not a PNG or is cut short', () => {
        expect(isPng(bytesOf('{"fileVersion":1}'))).toBe(false)
        expect(() => readChunks(bytesOf('GIF89a....'))).toThrow(InvalidPngError)
        expect(() => readChunks(MINIMAL_PNG.slice(0, 40))).toThrow(InvalidPngError)
        expect(() => readChunks(MINIMAL_PNG.slice(0, MINIMAL_PNG.length - 12))).toThrow(InvalidPngError) // no IEND
    })

    test('a tEXt chunk is keyword, NUL and text, with its CRC', () => {
        const chunk = encodeTextChunk('k', 'hi')
        expect(Array.from(chunk.slice(0, 8))).toEqual([0, 0, 0, 4, 116, 69, 88, 116]) // length 4 (k, NUL, h, i), "tEXt"
        expect(chunk.slice(8, 12)).toEqual(Uint8Array.from([107, 0, 104, 105]))
        expect(() => encodeTextChunk('', 'x')).toThrow()
        expect(() => encodeTextChunk('k'.repeat(80), 'x')).toThrow()
        expect(() => encodeTextChunk('k', 'ñ es Latin-1 pero 🍅 no')).toThrow()
    })

    test('round trip: insert before IEND, read it back, the image chunks are untouched', () => {
        const out = insertTextChunk(MINIMAL_PNG, 'clave', 'valor')
        expectWellFormed(out)
        const types = readChunks(out).map(c => c.type)
        expect(types).toEqual(['IHDR', 'IDAT', 'tEXt', 'IEND'])
        expect(readTextChunk(out, 'clave')).toBe('valor')
        expect(readTextChunk(out, 'otra')).toBeNull()
        expect(readTextChunk(MINIMAL_PNG, 'clave')).toBeNull()
        // the signature, IHDR and IDAT are copied as they were (8 + 25 + 23 bytes), then the new chunk, then IEND
        expect(out.slice(0, 56)).toEqual(MINIMAL_PNG.slice(0, 56))
        expect(out.slice(out.length - 12)).toEqual(MINIMAL_PNG.slice(56))
        expect(out.length).toBe(MINIMAL_PNG.length + 12 + 'clave'.length + 1 + 'valor'.length)
    })

    test('inserting again replaces the chunk with the same keyword (no duplicates)', () => {
        const twice = insertTextChunk(insertTextChunk(insertTextChunk(MINIMAL_PNG, 'a', 'uno'), 'b', 'otro'), 'a', 'dos')
        expectWellFormed(twice)
        expect(readChunks(twice).filter(c => c.type === 'tEXt')).toHaveLength(2)
        expect(readTextChunk(twice, 'a')).toBe('dos')
        expect(readTextChunk(twice, 'b')).toBe('otro')
    })

    test('a chunk with a broken CRC is ignored', () => {
        const out = insertTextChunk(MINIMAL_PNG, 'clave', 'valor')
        const corrupted = out.slice()
        const textStart = readChunks(out).find(c => c.type === 'tEXt')!.offset + 8
        corrupted[textStart + 7] ^= 0xff // flip a byte of the text
        expect(readTextChunk(corrupted, 'clave')).toBeNull()
    })

    test('asciiJson escapes everything outside printable ASCII and parses to the same value', () => {
        const json = asciiJson(challenge)
        expect(/^[\x20-\x7e]*$/.test(json)).toBe(true)
        expect(JSON.parse(json)).toEqual(challenge)
    })
})

describe('challenge inside the PNG', () => {
    test('export, read and compare: the whole challenge with its fileVersion', () => {
        const png = embedChallenge(MINIMAL_PNG, challenge)
        expectWellFormed(png)
        const result = extractChallenge(png)
        expect(result).toEqual({ status: 'ok', challenge })
        if (result.status === 'ok') {
            expect(result.challenge.fileVersion).toBe(creatorVersion)
            expect(isValidChallenge(result.challenge)).toBe(true)
        }
        expect(readTextChunk(png, CHALLENGE_PNG_KEYWORD)).toContain('"fileVersion":1')
    })

    test('the initial solution can be left out', () => {
        const result = extractChallenge(embedChallenge(MINIMAL_PNG, challenge, { includeSolution: false }))
        expect(result.status).toBe('ok')
        if (result.status !== 'ok') return
        expect(result.challenge.predefinedSolution).toBeUndefined()
        const { predefinedSolution, ...rest } = challenge
        expect(result.challenge).toEqual(rest)
    })

    test('a PNG without data, a newer version, invalid data and other files give a clear status', () => {
        expect(extractChallenge(MINIMAL_PNG)).toEqual({ status: 'noData' })
        expect(extractChallenge(insertTextChunk(MINIMAL_PNG, 'Software', 'otro programa'))).toEqual({ status: 'noData' })
        expect(extractChallenge(embedChallenge(MINIMAL_PNG, { ...challenge, fileVersion: creatorVersion + 1 }))).toEqual({ status: 'newerVersion', fileVersion: creatorVersion + 1 })
        expect(extractChallenge(insertTextChunk(MINIMAL_PNG, CHALLENGE_PNG_KEYWORD, '{"pepita":1}'))).toEqual({ status: 'invalid' })
        expect(extractChallenge(insertTextChunk(MINIMAL_PNG, CHALLENGE_PNG_KEYWORD, 'no es json'))).toEqual({ status: 'invalid' })
        expect(extractChallenge(bytesOf(JSON.stringify(challenge)))).toEqual({ status: 'notPng' })
        expect(extractChallenge(MINIMAL_PNG.slice(0, 30))).toEqual({ status: 'notPng' })
        // what a re-encoder or a screenshot leaves: a different, valid PNG without our chunk
        const reencoded = MINIMAL_PNG.slice()
        expect(extractChallenge(reencoded)).toEqual({ status: 'noData' })
    })

    test('PNG signature constant', () => {
        expect(Array.from(PNG_SIGNATURE)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    })
})
