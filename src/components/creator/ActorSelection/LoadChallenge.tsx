import { Button, darken, Tooltip } from "@mui/material"
import UploadIcon from '../../home/UploadIcon';
import { LocalStorage } from "../../../localStorage"
import { SerializedChallenge } from "../../serializedChallenge"
import { IMPORT_ACCEPT, ImportOutcome, readChallengeFile } from "../../home/ImportChallengeCard"
import { DialogSnackbar } from "../../dialogSnackbar/DialogSnackbar";
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useThemeContext } from "../../../theme/ThemeContext"
import { useNavigate } from "react-router-dom"

export const LoadChallengeButton = () => {
	const { t } = useTranslation("creator")
    // The error messages are the ones of the home screen import, which reads the same files.
    const { t: tHome } = useTranslation("home")
    const { isSmallScreen, theme } = useThemeContext()
	const navigate = useNavigate()
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [errorKey, setErrorKey] = useState<Extract<ImportOutcome, { errorKey: string }>['errorKey']>('importError');

	const goToCreatorChallenge = (challenge: SerializedChallenge) => {
		LocalStorage.saveCreatorChallenge(challenge)
		navigate("/creador/editar")
	}

    const readFile = async (event: any) => {
        const file: File = event.target.files[0]
        event.target.value = null // Without this Chrome seems to cache the file and prevents reruns of this function.
        if (!file) return

        const outcome = await readChallengeFile(file)
        if ('challenge' in outcome) goToCreatorChallenge(outcome.challenge)
        else {
            setErrorKey(outcome.errorKey)
            setSnackbarOpen(true)
        }
    }

	return (
        <Tooltip title={isSmallScreen ? t(`editor.buttons.loadChallenge`) : ''}>
            <Button variant="outlined" sx={{
                textTransform: "none",
                marginRight: '10px',
                whiteSpace: 'nowrap',
                backgroundColor: theme.palette.text.secondary, 
                fontWeight: 'bold', 
                fontSize: 16,
                    '&:hover': {
                        backgroundColor: darken(theme.palette.text.secondary, 0.2),
                    } }}
                component="label"
                startIcon={<UploadIcon />}>
                {t(`editor.buttons.loadChallenge${isSmallScreen ? 'Short' : ''}`)}
                <input data-testid="import-input" hidden accept={IMPORT_ACCEPT} type="file" onChange={readFile} />
                <DialogSnackbar
                    open={snackbarOpen}
                    onClose={() => setSnackbarOpen(false)}
                    message={tHome(errorKey)} />
            </Button>            
        </Tooltip>
	)
}

