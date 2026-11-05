import { CreatorCard } from './CreateChallengeCard';
import Button from '@mui/material/Button';
import { Ember } from "../../emberCommunication";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SerializedChallenge, isValidChallenge } from "../serializedChallenge";
import { DialogSnackbar } from "../dialogSnackbar/DialogSnackbar";
import UploadIcon from './UploadIcon';
import { extractChallenge } from '../creator/challengePng';
import { blobToBytes } from '../creator/drawBoardImage';

/** Accepted files: the .dpbq challenge file and the PNG exported by the creator (challenge inside). */
export const IMPORT_ACCEPT = ".dpbq,.png,image/png"

const isPngFile = (file: File) => file.type === 'image/png' || /\.png$/i.test(file.name || '')

export type ImportOutcome = { challenge: SerializedChallenge } | { errorKey: 'importError' | 'importPngNoData' | 'importNewerVersion' }

/** Reads a .dpbq (JSON) or an exported .png into a challenge, or the i18n key (home) of the error to show. */
export const readChallengeFile = async (file: File): Promise<ImportOutcome> => {
    if (isPngFile(file)) {
        const result = extractChallenge(await blobToBytes(file))
        switch (result.status) {
            case 'ok': return { challenge: result.challenge }
            case 'noData': return { errorKey: 'importPngNoData' }
            case 'newerVersion': return { errorKey: 'importNewerVersion' }
            default: return { errorKey: 'importError' }
        }
    }
    let challengeJson: unknown
    try {
        challengeJson = JSON.parse(await file.text())
    } catch {
        return { errorKey: 'importError' }
    }
    return isValidChallenge(challengeJson) ? { challenge: challengeJson } : { errorKey: 'importError' }
}

export const ImportChallengeCard = () => {
    const { t } = useTranslation("home");
    const navigate = useNavigate();
    const [errorKey, setErrorKey] = useState<string>('importError');
    const [snackbarOpen, setSnackbarOpen] = useState(false);

    const goToChallenge = (challenge: SerializedChallenge) => {
        Ember.importChallenge(challenge)
        navigate("/desafioImportado", {state: challenge})
    }

    const readFile = async (event: any) => {
        const file: File = event.target.files[0]
        event.target.value = null // Without this Chrome seems to cache the file and prevents reruns of this function.
        if (!file) return

        const outcome = await readChallengeFile(file)
        if ('challenge' in outcome) goToChallenge(outcome.challenge)
        else {
            setErrorKey(outcome.errorKey)
            setSnackbarOpen(true)
        }
    }

    return <>
    <Button component="label" style={{textTransform: 'none', padding: 0}}>
        <CreatorCard visibleBadge={true} text={t("cards.import")} color={"#ffffff"} icon={UploadIcon}/>
        <input data-testid="import-input" hidden accept={IMPORT_ACCEPT} type="file" onChange={readFile}/>
        <DialogSnackbar
            open={snackbarOpen}
            onClose={() => setSnackbarOpen(false)}
            message={t(errorKey)}/>
    </Button>
</>
}
