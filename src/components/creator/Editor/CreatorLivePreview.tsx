import { Alert, Stack } from "@mui/material";
import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LocalStorage } from "../../../localStorage";
import { ChallengeView } from "../../challengeView/ChallengeView";
import { EMBER_IMPORTED_CHALLENGE_PATH } from "../../ImportedChallengeView";
import { SerializedChallenge, defaultChallenge, isValidChallenge } from "../../serializedChallenge";
import { CreatorContext } from "./CreatorContext";
import { hasActor } from "./SceneEdition/mapUtils";

export const PREVIEW_DEBOUNCE_MS = 400

/** The challenge as it is in memory right now (LocalStorage is only written after render). */
export const useChallengeInMemory = (): SerializedChallenge => {
    const { maps, title, statement, clue, toolbox, assesments, sharedId } = useContext(CreatorContext)
    const saved = LocalStorage.getCreatorChallenge() || defaultChallenge('Duba')
    const json = JSON.stringify({
        ...saved,
        title,
        statement: clue === undefined ? { description: statement } : { description: statement, clue },
        scene: { ...saved.scene, maps },
        toolbox,
        assesments,
        sharedId: sharedId || undefined
    })
    // Same content => same object, so the debounce below only restarts on real changes.
    return useMemo(() => JSON.parse(json), [json])
}

/** A playable challenge: valid file, at least one scenario, every scenario with cells and exactly one actor. */
export const isPlayable = (challenge: SerializedChallenge) =>
    isValidChallenge(challenge) &&
    challenge.scene.maps.length > 0 &&
    challenge.scene.maps.every(map => map.length > 0 && map[0].length > 0 &&
        map.flat().filter(hasActor).length === 1)

export const useDebounced = <T,>(value: T, delay: number): T => {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timeout)
    }, [value, delay])
    return debounced
}

/**
 * Playable preview fed from CreatorContext, refreshed PREVIEW_DEBOUNCE_MS after the last change.
 * Only one is ever mounted, because SceneView uses the fixed iframe id "sceneIframe".
 */
export const CreatorLivePreview = () => {
    const { t } = useTranslation('creator')
    const challenge = useDebounced(useChallengeInMemory(), PREVIEW_DEBOUNCE_MS)

    return <Stack data-testid="creator-live-preview" sx={{ height: '100%', minHeight: 0, minWidth: 0, overflow: 'auto', borderRadius: '16px', backgroundColor: 'background.paper' }}>
        {isPlayable(challenge)
            ? <ChallengeView path={EMBER_IMPORTED_CHALLENGE_PATH} serializedChallenge={challenge} />
            : <Alert severity="info" role="status" data-testid="creator-live-preview-invalid" sx={{ margin: 2 }}>{t('editor.mode.invalid')}</Alert>}
    </Stack>
}
