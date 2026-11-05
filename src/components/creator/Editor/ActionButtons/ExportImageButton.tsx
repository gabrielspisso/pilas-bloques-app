import { useContext, useState } from "react";
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from "@mui/material";
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from "react-i18next";
import ReactGA from "react-ga4";
import { CreatorActionButton } from "./CreatorActionButton";
import { CreatorContext } from "../CreatorContext";
import { LocalStorage } from "../../../../localStorage";
import { defaultChallenge } from "../../../serializedChallenge";
import { canvasToPngBytes, downloadBytes, drawBoardImage } from "../../drawBoardImage";
import { imageFileName } from "../../boardImage";
import { DialogSnackbar } from "../../../dialogSnackbar/DialogSnackbar";
import { embedChallenge } from "../../challengePng";

export type ExportOptions = { includeTexts: boolean, includeSolution: boolean }

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = { includeTexts: true, includeSolution: true }

/**
 * Button next to "Download": exports the scenario being edited as a sharp PNG that also carries
 * the whole challenge (tEXt chunk, see challengePng.ts), so "Import your challenge" can open it.
 */
export const ExportImageButton = () => {
    const [open, setOpen] = useState(false)
    return <>
        <CreatorActionButton data-testid="export-image-button" onClick={() => setOpen(true)} startIcon={<ImageOutlinedIcon />} nametag='exportImage' />
        <ExportImageDialog open={open} onClose={() => setOpen(false)} />
    </>
}

const ExportImageDialog = ({ open, onClose }: { open: boolean, onClose: () => void }) => {
    const { t } = useTranslation('creator')
    const { maps, index, title, statement } = useContext(CreatorContext)
    const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')

    const handleExport = async () => {
        setBusy(true)
        try {
            const challenge = LocalStorage.getCreatorChallenge() || defaultChallenge('Duba')
            const map = maps[index] || challenge.scene.maps[index] || challenge.scene.maps[0]
            const { canvas, failedImages } = await drawBoardImage({
                sceneType: challenge.scene.type,
                map,
                ...(options.includeTexts ? { title, statement } : {}),
                devicePixelRatio: window.devicePixelRatio
            })
            // LocalStorage holds the complete draft (the context writes it after every change).
            const png = embedChallenge(await canvasToPngBytes(canvas), challenge, { includeSolution: options.includeSolution })
            downloadBytes(png, imageFileName(title), 'image/png')
            ReactGA.event({ category: "creator", action: "export_image" })
            if (failedImages.length) setMessage(t('editor.exportImage.missingImages')!)
            onClose()
        } catch (error) {
            setMessage(t('editor.exportImage.error')!)
        } finally {
            setBusy(false)
        }
    }

    return <>
        <Dialog open={open} onClose={onClose} aria-labelledby="export-image-title">
            <DialogTitle id="export-image-title">{t('editor.exportImage.title')}</DialogTitle>
            <DialogContent>
                <Stack gap={1}>
                    {maps.length > 1 && <Typography variant="body2" data-testid="export-image-scenario">
                        {t('editor.exportImage.scenario', { scenario: index + 1, total: maps.length })}
                    </Typography>}
                    <FormControlLabel
                        control={<Checkbox data-testid="export-include-texts" checked={options.includeTexts}
                            onChange={(_, checked) => setOptions({ ...options, includeTexts: checked })} />}
                        label={t('editor.exportImage.includeTexts')} />
                    <FormControlLabel
                        control={<Checkbox data-testid="export-include-solution" checked={options.includeSolution}
                            onChange={(_, checked) => setOptions({ ...options, includeSolution: checked })} />}
                        label={t('editor.exportImage.includeSolution')} />
                    <Typography variant="body2">{t('editor.exportImage.embedded')}</Typography>
                    <Alert severity="warning" data-testid="export-image-warning">{t('editor.exportImage.metadataWarning')}</Alert>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={{ textTransform: 'none' }}>{t('editor.exportImage.cancel')}</Button>
                <Button data-testid="export-image-confirm" variant="contained" onClick={handleExport} disabled={busy} sx={{ textTransform: 'none' }}>
                    {t('editor.exportImage.export')}
                </Button>
            </DialogActions>
        </Dialog>
        <DialogSnackbar open={!!message} onClose={() => setMessage('')} message={message} />
    </>
}
