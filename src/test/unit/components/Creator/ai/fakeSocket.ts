import { act } from "@testing-library/react"

/** Stands in for the WebSocket of the browser: the test plays the part of the MCP server. */
export class FakeSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSED = 3
    static instances: FakeSocket[] = []
    static get last() { return FakeSocket.instances[FakeSocket.instances.length - 1] }

    readyState = FakeSocket.CONNECTING
    sent: any[] = []
    closed = false
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null

    constructor(readonly url: string) { FakeSocket.instances.push(this) }

    send(data: string) { this.sent.push(JSON.parse(data)) }
    close() { this.closed = true; this.readyState = FakeSocket.CLOSED }

    open() { act(() => { this.readyState = FakeSocket.OPEN; this.onopen?.() }) }
    receive(message: unknown) { act(() => { this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) }) }) }
    drop() { act(() => { this.readyState = FakeSocket.CLOSED; this.onerror?.(); this.onclose?.() }) }

    private requests = 0
    /** Sends a request and returns the response of the app. */
    request(method: string, params: unknown = {}) {
        const id = `request-${++this.requests}`
        this.receive({ type: 'request', id, method, params })
        return this.sent.find(message => message.id === id)
    }
}

export const installFakeSocket = () => {
    const original = global.WebSocket
    beforeEach(() => {
        FakeSocket.instances = [];
        (global as any).WebSocket = FakeSocket
    })
    afterEach(() => { (global as any).WebSocket = original })
}
