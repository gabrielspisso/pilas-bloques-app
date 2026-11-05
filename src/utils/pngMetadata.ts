/**
 * Minimal PNG chunk handling over Uint8Array, without dependencies: CRC32, reading chunks and
 * inserting / reading tEXt chunks (PNG spec, section 11.3.4.3). Pure functions.
 *
 * Chunk layout: length (4 bytes, big endian, data only) | type (4 ASCII bytes) | data | CRC32 (type + data).
 */

export const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Max keyword length allowed by the spec for tEXt. */
export const MAX_KEYWORD_LENGTH = 79

let crcTable: Uint32Array | null = null

const table = (): Uint32Array => {
    if (crcTable) return crcTable
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        crcTable[n] = c >>> 0
    }
    return crcTable
}

/** CRC-32 (ISO 3309 / ITU-T V.42, the one PNG uses), as an unsigned 32-bit number. */
export const crc32 = (bytes: Uint8Array, start = 0, end = bytes.length): number => {
    const t = table()
    let c = 0xffffffff
    for (let i = start; i < end; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

export const isPng = (bytes: Uint8Array): boolean =>
    bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b)

export type PngChunk = {
    type: string
    /** Offset of the chunk (its length field) in the file. */
    offset: number
    /** Data of the chunk (a view into the file, not a copy). */
    data: Uint8Array
    /** Whether the stored CRC matches the type and data. */
    crcOk: boolean
}

export class InvalidPngError extends Error { }

const readUint32 = (bytes: Uint8Array, at: number) =>
    ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0

const writeUint32 = (bytes: Uint8Array, at: number, value: number) => {
    bytes[at] = (value >>> 24) & 0xff
    bytes[at + 1] = (value >>> 16) & 0xff
    bytes[at + 2] = (value >>> 8) & 0xff
    bytes[at + 3] = value & 0xff
}

const asciiOf = (bytes: Uint8Array, start: number, end: number) => {
    let s = ''
    for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i])
    return s
}

/**
 * All the chunks of a PNG, in order, up to IEND. Throws InvalidPngError when the signature is
 * missing, a chunk is cut short or there is no IEND.
 */
export const readChunks = (png: Uint8Array): PngChunk[] => {
    if (!isPng(png)) throw new InvalidPngError('not a PNG (signature)')
    const chunks: PngChunk[] = []
    let at = PNG_SIGNATURE.length
    while (at + 12 <= png.length) {
        const length = readUint32(png, at)
        const dataStart = at + 8
        const dataEnd = dataStart + length
        if (length > 0x7fffffff || dataEnd + 4 > png.length) throw new InvalidPngError('truncated chunk')
        const type = asciiOf(png, at + 4, at + 8)
        const crcOk = crc32(png, at + 4, dataEnd) === readUint32(png, dataEnd)
        chunks.push({ type, offset: at, data: png.subarray(dataStart, dataEnd), crcOk })
        at = dataEnd + 4
        if (type === 'IEND') return chunks
    }
    throw new InvalidPngError('missing IEND')
}

/** A complete chunk (length, type, data and its CRC). */
export const encodeChunk = (type: string, data: Uint8Array): Uint8Array => {
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error(`invalid chunk type ${type}`)
    const chunk = new Uint8Array(12 + data.length)
    writeUint32(chunk, 0, data.length)
    for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i)
    chunk.set(data, 8)
    writeUint32(chunk, 8 + data.length, crc32(chunk, 4, 8 + data.length))
    return chunk
}

const isValidKeyword = (keyword: string) =>
    keyword.length >= 1 && keyword.length <= MAX_KEYWORD_LENGTH && /^[\x20-\x7e]+$/.test(keyword) &&
    !keyword.startsWith(' ') && !keyword.endsWith(' ') && !keyword.includes('  ')

/** Latin-1 text with no NUL (what tEXt allows). */
const isLatin1Text = (text: string) => /^[\x01-\xff]*$/.test(text)

/** tEXt chunk data: keyword, a NUL separator, then the Latin-1 text. */
export const encodeTextChunk = (keyword: string, text: string): Uint8Array => {
    if (!isValidKeyword(keyword)) throw new Error('invalid tEXt keyword')
    if (!isLatin1Text(text)) throw new Error('tEXt only holds Latin-1 text: escape other characters first')
    const data = new Uint8Array(keyword.length + 1 + text.length)
    for (let i = 0; i < keyword.length; i++) data[i] = keyword.charCodeAt(i)
    data[keyword.length] = 0
    for (let i = 0; i < text.length; i++) data[keyword.length + 1 + i] = text.charCodeAt(i)
    return encodeChunk('tEXt', data)
}

const textChunkKeyword = (data: Uint8Array): { keyword: string, textStart: number } | null => {
    const separator = data.indexOf(0)
    if (separator < 1) return null
    return { keyword: asciiOf(data, 0, separator), textStart: separator + 1 }
}

/**
 * A copy of the PNG with a tEXt chunk (keyword, text) right before IEND. Earlier tEXt chunks with
 * the same keyword are dropped, so exporting again never duplicates the data.
 */
export const insertTextChunk = (png: Uint8Array, keyword: string, text: string): Uint8Array => {
    const chunks = readChunks(png)
    const iend = chunks[chunks.length - 1]
    const kept = chunks.filter(chunk => !(chunk.type === 'tEXt' && textChunkKeyword(chunk.data)?.keyword === keyword))
    const newChunk = encodeTextChunk(keyword, text)
    const parts: Uint8Array[] = [PNG_SIGNATURE]
    kept.forEach(chunk => {
        if (chunk === iend) parts.push(newChunk)
        parts.push(png.subarray(chunk.offset, chunk.offset + 12 + chunk.data.length))
    })
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
    let at = 0
    parts.forEach(part => { out.set(part, at); at += part.length })
    return out
}

/**
 * Text of the first tEXt chunk with that keyword and a valid CRC; null if there is none.
 * Throws InvalidPngError when the bytes are not a readable PNG.
 */
export const readTextChunk = (png: Uint8Array, keyword: string): string | null => {
    for (const chunk of readChunks(png)) {
        if (chunk.type !== 'tEXt' || !chunk.crcOk) continue
        const parsed = textChunkKeyword(chunk.data)
        if (parsed?.keyword === keyword) return asciiOf(chunk.data, parsed.textStart, chunk.data.length)
    }
    return null
}

/**
 * JSON whose characters outside printable ASCII are written as \uXXXX escapes: still the same
 * JSON for JSON.parse, and valid tEXt (Latin-1) content, without needing TextEncoder.
 */
export const asciiJson = (value: unknown): string =>
    JSON.stringify(value).replace(/[^\x20-\x7e]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
