import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LocalStorage } from "../../../localStorage";

export const TUTORIAL_STEPS = ['board', 'texts', 'try'] as const

/**
 * Three guided steps shown the first time the editor opens. Any way of closing it
 * (skip, finish, Escape) marks it as seen in localStorage so it does not come back.
 * MUI Dialog traps the focus and closes with Escape, so it works with the keyboard.
 */
export const CreatorTutorial = () => {
    const { t } = useTranslation('creator')
    const [open, setOpen] = useState(() => !LocalStorage.getCreatorTutorialDone())
    const [step, setStep] = useState(0)
    const isLast = step === TUTORIAL_STEPS.length - 1
    const id = TUTORIAL_STEPS[step]

    const close = () => {
        LocalStorage.saveCreatorTutorialDone()
        setOpen(false)
    }

    return <Dialog open={open} onClose={close} aria-labelledby="creator-tutorial-title" aria-describedby="creator-tutorial-text" data-testid="creator-tutorial" maxWidth="xs" fullWidth>
        <DialogTitle id="creator-tutorial-title" sx={{ fontWeight: 'bold' }}>{t(`editor.tutorial.steps.${id}.title`)}</DialogTitle>
        <DialogContent>
            <DialogContentText id="creator-tutorial-text">{t(`editor.tutorial.steps.${id}.text`)}</DialogContentText>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ marginTop: 2 }} aria-hidden>
                {TUTORIAL_STEPS.map((stepId, index) =>
                    <span key={stepId} style={{ width: 10, height: 10, borderRadius: '50%', background: 'currentColor', opacity: index === step ? 1 : 0.3 }} />)}
            </Stack>
            <Typography variant="caption" component="p" textAlign="center" data-testid="tutorial-progress">
                {t('editor.tutorial.progress', { current: step + 1, total: TUTORIAL_STEPS.length })}
            </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
            <Button onClick={close} data-testid="tutorial-skip" sx={{ textTransform: 'none' }}>{t('editor.tutorial.skip')}</Button>
            <Stack direction="row" spacing={1}>
                {step > 0 && <Button onClick={() => setStep(step - 1)} data-testid="tutorial-back" sx={{ textTransform: 'none' }}>{t('editor.tutorial.back')}</Button>}
                <Button variant="contained" autoFocus onClick={isLast ? close : () => setStep(step + 1)} data-testid="tutorial-next" sx={{ textTransform: 'none' }}>
                    {isLast ? t('editor.tutorial.done') : t('editor.tutorial.next')}
                </Button>
            </Stack>
        </DialogActions>
    </Dialog>
}
