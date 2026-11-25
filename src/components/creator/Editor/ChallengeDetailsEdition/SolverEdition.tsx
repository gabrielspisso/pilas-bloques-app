import { AutoFixHigh } from "@mui/icons-material";
import { Alert, Button, CardActionArea, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tooltip, Typography } from "@mui/material";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "../../../../theme/ThemeContext";
import { PBCard } from "../../../PBCard";
import { solveChallenge } from "../../solver/solveChallenge";
import { AssessmentWarning, Cell, SolverFailure, SolverNote, SolverResult, SolverSuccess } from "../../solver/types";
import { CreatorContext } from "../CreatorContext";
import { useChallengeInMemory } from "../CreatorLivePreview";
import { SolutionProgramView, useBlockName } from "./SolutionProgramView";

/** Card and dialog with a recommended solution for the scenario being edited. Nothing is saved. */
export const SolverEdition = () => {
    const { t } = useTranslation(['creator', 'blocks'])
    const { theme, isSmallScreen } = useThemeContext()
    const { index, setPreviewProgram } = useContext(CreatorContext)
    const challenge = useChallengeInMemory()
    const blockName = useBlockName()
    const [open, setOpen] = useState(false)
    const [result, setResult] = useState<SolverResult | null>(null)

    const openDialog = () => {
        setResult(null)
        setOpen(true)
    }

    useEffect(() => {
        if (!open) return
        // Deferred so that the dialog shows up before the search takes the main thread.
        const timeout = setTimeout(() => {
            try {
                setResult(solveChallenge(challenge, index, number => t('solver.procedureName', { number })))
            } catch (error) {
                console.error(error)
                setResult({ kind: 'verificationFailed' })
            }
        }, 0)
        return () => clearTimeout(timeout)
        // Computed once per opening.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    /** Interpolated values are plain text (React already escapes them). */
    const text = (key: string, values: object = {}): string =>
        t(`solver.${key}`, { ...values, interpolation: { escapeValue: false } }) as string

    const blockNames = (blocks: string[] = []) => blocks.map(blockName).join(', ')
    const actorName = () => t(`selection.cards.${challenge.scene.type}.name`, { defaultValue: challenge.scene.type }) as string
    const cellNames = (cells: Cell[]) => cells.map(({ row, column }) => text('cell', { row: row + 1, column: column + 1 })).join('; ')

    const errorText = (failure: SolverFailure) => text(`errors.${failure.kind}`, {
        actor: actorName(),
        blocks: 'blocks' in failure ? blockNames(failure.blocks) : '',
        cells: 'cells' in failure ? cellNames(failure.cells) : ''
    })

    const warningText = (warning: AssessmentWarning) => {
        if (warning.id === 'decompositionMissingBlock') return text('reasons.decompositionMissingBlock')
        const message = text(`warnings.${warning.id}`, { ...warning, name: 'name' in warning ? warning.name ?? text('mainName') : '' })
        if (!('reason' in warning)) return message
        return `${message} ${text(`reasons.${warning.reason}`, { blocks: blockNames('blocks' in warning ? warning.blocks : []) })}`
    }

    const noteText = (note: SolverNote) =>
        text(`notes.${note.id}`, { ...note, blocks: 'blocks' in note ? blockNames(note.blocks) : '' })

    const tryInPreview = (solution: SolverSuccess) => {
        setPreviewProgram({ xml: solution.xml, id: Date.now() })
        setOpen(false)
    }

    const lines = (testId: string, items: string[], title?: string) =>
        <Alert severity="info" data-testid={testId}>
            {title && <Typography variant="body2" fontWeight="bold">{title}</Typography>}
            {items.map((item, i) => <Typography key={i} variant="body2">{item}</Typography>)}
        </Alert>

    const success = (solution: SolverSuccess) =>
        <Stack spacing={1} data-testid="solver-result">
            <Alert severity="success">
                <Typography variant="body2">{text('solved', { blocks: solution.blocks })}</Typography>
                <Typography variant="body2">{text('notShortest')}</Typography>
            </Alert>
            <Typography variant="body2">{text('rawSteps', { steps: solution.rawSteps })}</Typography>
            {!solution.exactOrder && <Typography variant="body2">{text('notExact')}</Typography>}
            <SolutionProgramView program={solution.program} />
            {solution.scenarios.length > 1 && <Stack data-testid="solver-scenarios">
                {solution.scenarios.map(({ index, solved }) =>
                    <Typography key={index} variant="body2">{text(solved ? 'scenarioOk' : 'scenarioFail', { number: index + 1 })}</Typography>)}
            </Stack>}
            {solution.scenarios.some(({ solved }) => !solved) && <Alert severity="warning">{text('notAllScenarios')}</Alert>}
            {solution.warnings.length > 0 && lines('solver-warnings', solution.warnings.map(warningText), text('warningsTitle'))}
            {solution.notes.length > 0 && lines('solver-notes', solution.notes.map(noteText))}
        </Stack>

    const content = () => {
        if (!result) return <Stack alignItems="center" spacing={1}>
            <CircularProgress />
            <Typography variant="body2">{text('calculating')}</Typography>
        </Stack>
        if (result.kind === 'solved') return success(result)
        return <Alert severity="warning" data-testid="solver-error">{errorText(result)}</Alert>
    }

    return <>
        <PBCard sx={{ padding: theme.spacing(1), flexGrow: "1" }}>
            <Tooltip title={isSmallScreen ? text('button') : ''}>
                <CardActionArea onClick={openDialog} data-testid="solver-button" aria-label={text('button')}>
                    <Stack alignItems="center">
                        <AutoFixHigh aria-hidden sx={{ fontSize: 44, color: 'primary.main' }} />
                        {!isSmallScreen && <Typography variant="body2" textAlign="center">{text('button')}</Typography>}
                    </Stack>
                </CardActionArea>
            </Tooltip>
        </PBCard>
        <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="solver-title" maxWidth="sm" fullWidth>
            <DialogTitle id="solver-title" sx={{ fontWeight: 'bold' }}>{text('title')}</DialogTitle>
            <DialogContent>{content()}</DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                {result?.kind === 'solved' && <>
                    <Typography variant="caption" sx={{ flex: 1, minWidth: 160 }}>{text('tryHint')}</Typography>
                    <Button variant="contained" onClick={() => tryInPreview(result)} data-testid="solver-try">{text('tryInPreview')}</Button>
                </>}
                <Button onClick={() => setOpen(false)} data-testid="solver-close">{text('close')}</Button>
            </DialogActions>
        </Dialog>
    </>
}
