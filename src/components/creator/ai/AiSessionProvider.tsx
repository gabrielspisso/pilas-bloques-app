import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useBlockName } from "../Editor/ChallengeDetailsEdition/SolutionProgramView"
import { CreatorContext } from "../Editor/CreatorContext"
import { useChallengeInMemory } from "../Editor/CreatorLivePreview"
import { programToXml } from "../solver/programXml"
import { Changes, applyChanges, describeChallenge, recommendSolution, testProgram, validateChanges } from "./challengeTools"
import { ProposalDialog } from "./ProposalDialog"
import { AppMessage, DEFAULT_PORT, PROTOCOL_VERSION, ServerMessage } from "./protocol"

export const MAX_MESSAGE_BYTES = 256 * 1024
export const MAX_SUMMARY_LENGTH = 2000

export type AiStatus = 'disconnected' | 'connecting' | 'connected'
export type AiError = 'unreachable' | 'lost' | 'bad_code' | 'busy' | 'protocol'
export type Proposal = { id: string, summary: string, changes: Changes }
type ProposalStatus = 'pending' | 'applied' | 'rejected'

export type AiSession = {
    status: AiStatus
    /** Why it is disconnected, unless the teacher chose it. */
    error?: AiError
    /** Name of the assistant, e.g. "claude-code". */
    client?: string
    connect: (code: string) => void
    disconnect: () => void
    /** Waiting for the decision of the teacher. */
    proposal?: Proposal
    apply: () => void
    reject: () => void
}

const AiSessionContext = createContext<AiSession>({
    status: 'disconnected', connect: () => { }, disconnect: () => { }, apply: () => { }, reject: () => { }
})

export const useAiSession = () => useContext(AiSessionContext)

class RequestError extends Error {
    constructor(readonly code: string, message: string) { super(message) }
}

const readMessage = (data: unknown): ServerMessage | undefined => {
    try {
        const message = JSON.parse(String(data))
        return typeof message === 'object' && message !== null ? message : undefined
    } catch {
        return undefined
    }
}

const byteLength = (text: string) => new Blob([text]).size

/**
 * The connection with the local MCP server and the proposals it sends. It lives above the tabs and
 * modes of the creator, so they can change without closing it. Must be inside CreatorContextProvider.
 */
export const AiSessionProvider = ({ children }: { children: ReactNode }) => {
    const { t } = useTranslation(['creator', 'blocks'])
    const creator = useContext(CreatorContext)
    const challenge = useChallengeInMemory()
    const blockName = useBlockName()

    const [status, setStatus] = useState<AiStatus>('disconnected')
    const [error, setError] = useState<AiError>()
    const [client, setClient] = useState<string>()
    const [proposal, setProposal] = useState<Proposal>()

    const socket = useRef<WebSocket>()
    // Kept in a ref too: two requests can arrive before React renders again.
    const pending = useRef<Proposal>()
    const statuses = useRef(new Map<string, ProposalStatus>())

    // Requests arrive at any time: they are answered with the latest render, not with an old closure.
    const latest = useRef({ creator, challenge, blockName, t })
    latest.current = { creator, challenge, blockName, t }

    const close = (reason?: ProposalStatus) => {
        if (pending.current && reason) statuses.current.set(pending.current.id, reason)
        pending.current = undefined
        setProposal(undefined)
    }

    const propose = (params: any) => {
        if (pending.current)
            throw new RequestError('proposal_pending', 'There is a proposal waiting for the teacher. Check it with get_proposal_status.')

        const { summary, changes } = params ?? {}
        const errors = typeof summary === 'string' && summary.trim() && summary.length <= MAX_SUMMARY_LENGTH ?
            validateChanges(latest.current.challenge, changes) :
            [`"summary" is a text of up to ${MAX_SUMMARY_LENGTH} characters`]
        if (errors.length) return { errors }

        const next: Proposal = { id: `proposal-${Date.now()}-${statuses.current.size + 1}`, summary, changes }
        pending.current = next
        statuses.current.set(next.id, 'pending')
        setProposal(next)
        return { proposalId: next.id, status: 'pending' }
    }

    const answer = (method: string, params: unknown): unknown => {
        const { creator, challenge, blockName, t } = latest.current
        const procedureName = (number: number) => t('solver.procedureName', { number }) as string

        switch (method) {
            case 'get_challenge':
                return describeChallenge(challenge, { scenario: creator.index, previewXml: creator.previewProgram?.xml, blockName })
            case 'get_recommended_solution': return recommendSolution(challenge, params, creator.index, procedureName)
            case 'test_program': return testProgram(challenge, params)
            case 'propose_changes': return propose(params)
            case 'get_proposal_status':
                return { status: statuses.current.get((params as any)?.proposalId) ?? 'unknown' }
            default: throw new RequestError('unknown_method', `Unknown method ${method}`)
        }
    }

    const respond = (target: WebSocket, id: string, method: string, params: unknown) => {
        const send = (message: AppMessage) => target.send(JSON.stringify(message))
        const fail = (code: string, message: string) => send({ type: 'response', id, ok: false, error: { code, message } })
        try {
            const response: AppMessage = { type: 'response', id, ok: true, result: answer(method, params) }
            // The server drops a connection that sends larger messages.
            if (byteLength(JSON.stringify(response)) > MAX_MESSAGE_BYTES) return fail('too_large', 'The answer is too large (more than 256 KB).')
            send(response)
        } catch (failure) {
            if (!(failure instanceof RequestError)) console.error(failure)
            fail(failure instanceof RequestError ? failure.code : 'internal',
                failure instanceof Error ? failure.message : String(failure))
        }
    }

    /** Closes the current socket and forgets it, so its later events are ignored. */
    const drop = () => {
        const current = socket.current
        socket.current = undefined
        if (!current) return
        if (current.readyState === WebSocket.OPEN) current.send(JSON.stringify({ type: 'bye' } satisfies AppMessage))
        current.close()
    }

    const connect = (code: string) => {
        drop()
        setError(undefined)
        setClient(undefined)
        setStatus('connecting')

        const next = new WebSocket(`ws://127.0.0.1:${DEFAULT_PORT}`)
        socket.current = next
        let welcomed = false
        let rejection: AiError | undefined

        next.onopen = () => {
            if (socket.current !== next) return
            next.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, code: code.trim().toUpperCase() } satisfies AppMessage))
        }
        next.onmessage = event => {
            const message = socket.current === next ? readMessage(event.data) : undefined
            if (message?.type === 'welcome') {
                welcomed = true
                setClient(String(message.client))
                setStatus('connected')
            }
            if (message?.type === 'rejected') rejection = message.reason
            if (message?.type === 'request' && welcomed) respond(next, message.id, message.method, message.params)
        }
        next.onclose = () => {
            if (socket.current !== next) return
            socket.current = undefined
            setStatus('disconnected')
            setError(rejection ?? (welcomed ? 'lost' : 'unreachable'))
        }
    }

    const disconnect = () => {
        drop()
        close('rejected')
        setStatus('disconnected')
        setError(undefined)
        setClient(undefined)
    }

    useEffect(() => drop, [])

    const apply = () => {
        const current = pending.current
        if (!current) return
        const { creator, challenge } = latest.current
        const { changes } = current
        // The draft may have changed since the proposal arrived (e.g. with undo).
        if (validateChanges(challenge, changes).length) return

        const result = applyChanges(challenge, changes)
        creator.keepVersion()
        if (changes.maps) {
            creator.setMaps(result.scene.maps.map(map => map.map(row => row.slice())))
            creator.setIndex(0)
        }
        if (changes.title !== undefined) creator.setTitle(result.title)
        if (changes.description !== undefined) creator.setStatement(result.statement.description)
        if (changes.clue !== undefined) creator.setClue(result.statement.clue)
        if (changes.toolbox) creator.setToolbox(result.toolbox)
        if (changes.assesments) creator.setAssesments(result.assesments)
        if (changes.initialProgram !== undefined) creator.setInitialSolution(result.predefinedSolution)
        if (changes.previewProgram)
            creator.setPreviewProgram({ xml: programToXml(changes.previewProgram), id: Date.now() })
        // An older program would keep hiding the new starting blocks in the preview.
        else if (changes.initialProgram !== undefined) creator.setPreviewProgram(null)

        close('applied')
    }

    const reject = () => close('rejected')

    return <AiSessionContext.Provider value={{ status, error, client, connect, disconnect, proposal, apply, reject }}>
        {children}
        <ProposalDialog />
    </AiSessionContext.Provider>
}
