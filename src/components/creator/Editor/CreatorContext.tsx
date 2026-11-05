import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Assesments, SceneMap, SerializedChallenge, Toolbox, defaultChallenge } from '../../serializedChallenge';
import { addVersion } from '../versions';
import { LocalStorage } from '../../../localStorage';
import { ACTOR } from './SceneEdition/mapUtils';

export const HISTORY_LIMIT = 50

export type CreatorContextType = {
    selectedTool: string;
    setSelectedTool: (selectedTool: string) => void;
    currentMap: SceneMap;
    setCurrentMap: (map: SceneMap) => void;
    index: number;
    setIndex: (index: number) => void;
    setMaps: (maps: any) => void;
    maps: SceneMap[];
    sharedId: string
    setSharedId: (id: string) => void
    title: string
    setTitle: (title: string) => void
    statement: string
    setStatement: (statement: string) => void
    clue?: string
    setClue: (clue?: string) => void
    toolbox: Toolbox
    setToolbox: (toolbox: Toolbox) => void
    assesments?: Assesments
    setAssesments: (assesments?: Assesments) => void
    /** When the draft was last written to LocalStorage after an edit (null: nothing edited in this visit). */
    lastSavedAt: number | null
    /** Replaces the whole draft (e.g. restoring a version). The map change can be undone. */
    loadChallenge: (challenge: SerializedChallenge) => void
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean
    /** Every map change between begin and end counts as a single undo step (e.g. a paint stroke). */
    beginHistoryBatch: () => void
    endHistoryBatch: () => void
};

const defaultCreatorContext = {
    selectedTool: '',
    setSelectedTool: () => { },
    currentMap: defaultChallenge('Duba').scene.maps[0],
    setCurrentMap: () => { },
    index: 0,
    setIndex: () => { },
    setMaps: () => { },
    maps: defaultChallenge('Duba').scene.maps,
    sharedId: "",
    setSharedId: (id: string) => {},
    title: '',
    setTitle: () => { },
    statement: '',
    setStatement: () => { },
    clue: undefined,
    setClue: () => { },
    toolbox: { blocks: [] },
    setToolbox: () => { },
    assesments: undefined,
    setAssesments: () => { },
    lastSavedAt: null,
    loadChallenge: () => { },
    undo: () => { },
    redo: () => { },
    canUndo: false,
    canRedo: false,
    beginHistoryBatch: () => { },
    endHistoryBatch: () => { }
}

export const CreatorContext = React.createContext<CreatorContextType>(defaultCreatorContext);

export type CreatorProviderProps = {
    children: React.ReactNode;
    defaultSelectedTool?: string;
    defaultIndex?: number;
};

type HistoryEntry = { maps: SceneMap[], index: number }

const cloneMaps = (maps: SceneMap[]): SceneMap[] => maps.map(map => map.map(row => row.slice()))

const sameMaps = (a: SceneMap[], b: SceneMap[]) => JSON.stringify(a) === JSON.stringify(b)

export const CreatorContextProvider: React.FC<CreatorProviderProps> = ({ children, defaultSelectedTool = ACTOR, defaultIndex = 0 }: CreatorProviderProps) => {
    const [selectedTool, setSelectedTool] = useState(defaultSelectedTool);

    const challenge = LocalStorage.getCreatorChallenge() || defaultChallenge("Duba")
    const [maps, setMapsState] = useState(challenge.scene.maps)
    const [index, setIndex] = useState(defaultIndex)
    const [sharedId, setSharedId] = useState(challenge.sharedId || "")
    const [title, setTitle] = useState(challenge.title)
    const [statement, setStatement] = useState(challenge.statement.description)
    const [clue, setClue] = useState<string | undefined>(challenge.statement.clue)
    const [toolbox, setToolbox] = useState<Toolbox>(challenge.toolbox)
    const [assesments, setAssesments] = useState<Assesments | undefined>(challenge.assesments)

    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
    const lastSavedJson = useRef<string | null>(null)
    const openedAt = useRef<number | undefined>(undefined)

    const [past, setPast] = useState<HistoryEntry[]>([])
    const [future, setFuture] = useState<HistoryEntry[]>([])

    // Editing code mutates the current maps in place before calling setCurrentMap/setMaps,
    // so the previous state is kept here as an independent copy.
    const committed = useRef<HistoryEntry>({ maps: cloneMaps(maps), index })
    const batch = useRef({ active: false, recorded: false })

    const currentMap = maps[index] || challenge.scene.maps[index]

    const commit = (newMaps: SceneMap[]) => {
        if (sameMaps(newMaps, committed.current.maps)) {
            setMapsState(newMaps)
            return
        }
        const shouldRecord = !batch.current.active || !batch.current.recorded
        if (shouldRecord) {
            const previous = committed.current
            setPast(prev => prev.concat([previous]).slice(-HISTORY_LIMIT))
            setFuture([])
            if (batch.current.active) batch.current.recorded = true
        }
        committed.current = { maps: cloneMaps(newMaps), index }
        setMapsState(newMaps)
    }

    const setCurrentMap = (map: SceneMap) => {
        maps[index] = map
        commit([...maps])
    }

    const setMaps = (newMaps: SceneMap[]) => commit(newMaps)

    // Each entry keeps the index where its maps were committed, so undo/redo show the edited scenario.
    const restore = (entry: HistoryEntry, showIndex: number) => {
        const restoredMaps = cloneMaps(entry.maps)
        committed.current = { maps: cloneMaps(entry.maps), index: entry.index }
        setMapsState(restoredMaps)
        setIndex(Math.max(0, Math.min(showIndex, restoredMaps.length - 1)))
    }

    const undo = () => {
        if (!past.length) return
        const entry = past[past.length - 1]
        const changedAt = committed.current.index
        setPast(past.slice(0, -1))
        setFuture(future.concat([committed.current]))
        restore(entry, changedAt)
    }

    const redo = () => {
        if (!future.length) return
        const entry = future[future.length - 1]
        setFuture(future.slice(0, -1))
        setPast(past.concat([committed.current]).slice(-HISTORY_LIMIT))
        restore(entry, entry.index)
    }

    const loadChallenge = (loaded: SerializedChallenge) => {
        commit(cloneMaps(loaded.scene.maps))
        setIndex(0)
        setTitle(loaded.title)
        setStatement(loaded.statement.description)
        setClue(loaded.statement.clue)
        setToolbox(loaded.toolbox)
        setAssesments(loaded.assesments)
    }

    const beginHistoryBatch = useCallback(() => { batch.current = { active: true, recorded: false } }, [])
    const endHistoryBatch = useCallback(() => { batch.current = { active: false, recorded: false } }, [])

    useEffect(() => {
        challenge.scene.maps = maps
        challenge.sharedId = sharedId
        challenge.title = title
        challenge.statement = { ...challenge.statement, description: statement, clue }
        if (clue === undefined) delete challenge.statement.clue
        challenge.toolbox = toolbox
        if (assesments) challenge.assesments = assesments
        else delete challenge.assesments
        LocalStorage.saveCreatorChallenge(challenge)

        // Only real edits count for the indicator and the versions (this effect also runs on mount).
        const json = JSON.stringify(challenge)
        if (lastSavedJson.current === null) {
            // The draft as it was when the editor opened is always a version, kept until it gets old.
            const now = Date.now()
            const versions = LocalStorage.getCreatorVersions()
            const updated = addVersion(versions, challenge, now, versions[versions.length - 1]?.savedAt)
            if (updated !== versions) LocalStorage.saveCreatorVersions(updated)
            openedAt.current = updated[updated.length - 1]?.savedAt
        } else if (lastSavedJson.current !== json) {
            const now = Date.now()
            LocalStorage.saveCreatorVersions(addVersion(LocalStorage.getCreatorVersions(), challenge, now, openedAt.current))
            setLastSavedAt(now)
        }
        lastSavedJson.current = json
    }, [maps, challenge, sharedId, title, statement, clue, toolbox, assesments])

    return (
        <CreatorContext.Provider value={{
            selectedTool, setSelectedTool, currentMap, setCurrentMap, sharedId: sharedId, setSharedId: setSharedId, title, setTitle, statement, setStatement, clue, setClue, toolbox, setToolbox, assesments, setAssesments, lastSavedAt, loadChallenge, index, setIndex, setMaps, maps,
            undo, redo, canUndo: past.length > 0, canRedo: future.length > 0, beginHistoryBatch, endHistoryBatch
        }}>
            {children}
        </CreatorContext.Provider>
    );
};
