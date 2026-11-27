import { FactCheck } from "@mui/icons-material";
import { Button, CardActionArea, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, TextField, Tooltip, Typography } from "@mui/material";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "../../../../theme/ThemeContext";
import { PBCard } from "../../../PBCard";
import { Assesments } from "../../../serializedChallenge";
import { DEFAULT_MAX_PROGRAM_LENGTH, MAX_PROGRAM_LENGTH, MIN_PROGRAM_LENGTH, clampProgramLength } from "../../assessments";
import { CreatorContext } from "../CreatorContext";

type BooleanAssessment = 'itWorks' | 'simpleRepetition' | 'conditionalRepetition' | 'conditionalAlternative'
const BOOLEAN_ASSESSMENTS: BooleanAssessment[] = ['itWorks', 'simpleRepetition', 'conditionalRepetition', 'conditionalAlternative']

const isOn = (assesments: Assesments | undefined, id: BooleanAssessment) =>
    id === 'itWorks' ? assesments?.itWorks !== false : !!assesments?.[id]

/** Assessments section: which Mulang expectations the student's program is checked against. Changes apply at once. */
export const AssessmentsEdition = () => {
    const { t } = useTranslation('creator')
    const { theme, isSmallScreen } = useThemeContext()
    const { assesments, setAssesments } = useContext(CreatorContext)
    const [open, setOpen] = useState(false)
    const [lengthText, setLengthText] = useState(String(assesments?.decomposition?.maxProgramLength ?? DEFAULT_MAX_PROGRAM_LENGTH))

    const current: Assesments = { itWorks: true, ...assesments }
    const update = (changes: Partial<Assesments>) => {
        const next: Assesments = { ...current, ...changes }
        if (!next.decomposition) delete next.decomposition
        setAssesments(next)
    }

    const toggleDecomposition = (checked: boolean) =>
        update({ decomposition: checked ? { maxProgramLength: clampProgramLength(Number(lengthText)) } : undefined })

    const changeLength = (text: string) => {
        setLengthText(text)
        const value = Number(text)
        if (text !== '' && !isNaN(value) && current.decomposition) update({ decomposition: { maxProgramLength: clampProgramLength(value) } })
    }

    const activeCount = BOOLEAN_ASSESSMENTS.filter(id => id !== 'itWorks' && isOn(assesments, id)).length + (assesments?.decomposition ? 1 : 0)

    return <>
        <PBCard sx={{ padding: theme.spacing(1), flexGrow: "1" }}>
            <Tooltip title={isSmallScreen ? t('assessments.button') : ''}>
                <CardActionArea onClick={() => setOpen(true)} data-testid="assessments-button" aria-label={t('assessments.button')!}>
                    <Stack alignItems="center">
                        <FactCheck aria-hidden sx={{ fontSize: 44, color: 'primary.main' }} />
                        {!isSmallScreen && <Typography variant="body2" textAlign="center">{t('assessments.button')}</Typography>}
                        {activeCount > 0 && <Typography variant="caption" data-testid="assessments-count">{t('assessments.active', { count: activeCount })}</Typography>}
                    </Stack>
                </CardActionArea>
            </Tooltip>
        </PBCard>
        <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="assessments-title" maxWidth="sm" fullWidth>
            <DialogTitle id="assessments-title" sx={{ fontWeight: 'bold' }}>{t('assessments.title')}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" sx={{ marginBottom: 1 }}>{t('assessments.hint')}</Typography>
                <Stack>
                    {BOOLEAN_ASSESSMENTS.map(id =>
                        <FormControlLabel key={id} label={t(`assessments.items.${id}`)}
                            control={<Switch color="secondary" checked={isOn(assesments, id)} inputProps={{ 'data-testid': `assessment-${id}` } as any}
                                onChange={event => update({ [id]: event.target.checked })} />} />)}
                    <FormControlLabel label={t('assessments.items.decomposition')}
                        control={<Switch color="secondary" checked={!!assesments?.decomposition} inputProps={{ 'data-testid': 'assessment-decomposition' } as any}
                            onChange={event => toggleDecomposition(event.target.checked)} />} />
                    <TextField type="number" size="small" label={t('assessments.maxProgramLength')} value={lengthText}
                        disabled={!assesments?.decomposition} onChange={event => changeLength(event.target.value)}
                        onBlur={() => setLengthText(String(clampProgramLength(Number(lengthText))))}
                        helperText={t('assessments.maxProgramLengthHelp', { min: MIN_PROGRAM_LENGTH, max: MAX_PROGRAM_LENGTH })}
                        inputProps={{ min: MIN_PROGRAM_LENGTH, max: MAX_PROGRAM_LENGTH, 'data-testid': 'assessment-max-length' }}
                        sx={{ marginTop: 1, marginLeft: 6, maxWidth: 260 }} />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="contained" onClick={() => setOpen(false)} data-testid="assessments-close">{t('assessments.close')}</Button>
            </DialogActions>
        </Dialog>
    </>
}
