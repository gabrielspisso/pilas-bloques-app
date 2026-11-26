import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material"
import { ReactNode, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Assesments, SceneMap } from "../../serializedChallenge"
import { SolutionProgramView } from "../Editor/ChallengeDetailsEdition/SolutionProgramView"
import { useSolverText } from "../Editor/ChallengeDetailsEdition/useSolverText"
import { useChallengeInMemory } from "../Editor/CreatorLivePreview"
import { useAiSession } from "./AiSessionProvider"
import { applyChanges, testProgram, validateChanges } from "./challengeTools"

/** The proposal of the assistant, field by field, for the teacher to apply or reject. */
export const ProposalDialog = () => {
    const { proposal, apply, reject } = useAiSession()
    const { t } = useTranslation('creator')
    const challenge = useChallengeInMemory()
    const { text: solverText, blockNames, warningText } = useSolverText()

    const review = useMemo(() => {
        if (!proposal) return undefined
        const valid = !validateChanges(challenge, proposal.changes).length
        if (!valid) return { valid }
        const result = applyChanges(challenge, proposal.changes)
        const program = proposal.changes.previewProgram
        const tested = program ? testProgram(result, { program }) : undefined
        return { valid, result, tested: tested && 'scenarios' in tested ? tested : undefined }
    }, [proposal, challenge])

    if (!proposal || !review) return null

    const { changes } = proposal
    const text = (key: string, values: object = {}) => t(`ai.proposal.${key}`, { ...values }) as string

    /** Proposed texts come from outside: always plain text, never HTML or markdown. */
    const plain = (value?: string) =>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value || text('none')}</Typography>

    const boards = (maps: SceneMap[]) => <Stack spacing={1}>
        {maps.map((map, i) => <Box key={i}>
            {maps.length > 1 && <Typography variant="caption">{text('scenario', { number: i + 1 })}</Typography>}
            <Box component="pre" sx={{ margin: 0, overflowX: 'auto' }}>
                {map.map(row => row.join(' ')).join('\n')}
            </Box>
        </Box>)}
    </Stack>

    const evaluations = (assesments?: Assesments) => {
        const active = Object.entries({ itWorks: true, ...assesments }).filter(([, value]) => !!value)
        return plain(active.map(([key, value]) => {
            const name = t(`assessments.items.${key}`) as string
            return typeof value === 'object' ? `${name} (${t('assessments.maxProgramLength')}: ${value.maxProgramLength})` : name
        }).join('\n'))
    }

    const field = (id: string, content: ReactNode) =>
        <Box data-testid={`ai-change-${id}`}>
            <Typography variant="subtitle2" fontWeight="bold">{text(`fields.${id}`)}</Typography>
            {content}
        </Box>

    const comparison = (id: string, before: ReactNode, after: ReactNode) => field(id,
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box flex={1} minWidth={0} sx={{ opacity: 0.75 }}><Typography variant="caption">{text('before')}</Typography>{before}</Box>
            <Box flex={1} minWidth={0}><Typography variant="caption">{text('after')}</Typography>{after}</Box>
        </Stack>)

    const changedFields = () => <>
        {changes.title !== undefined && comparison('title', plain(challenge.title), plain(changes.title))}
        {changes.description !== undefined && comparison('description', plain(challenge.statement.description), plain(changes.description))}
        {changes.clue !== undefined && comparison('clue', plain(challenge.statement.clue), plain(changes.clue))}
        {changes.maps && comparison('maps', boards(challenge.scene.maps), boards(changes.maps))}
        {changes.toolbox && comparison('toolbox', plain(blockNames(challenge.toolbox.blocks)), plain(blockNames(changes.toolbox)))}
        {changes.assesments && comparison('assesments', evaluations(challenge.assesments), evaluations(changes.assesments))}
        {changes.initialProgram !== undefined && comparison('initialProgram',
            plain(challenge.predefinedSolution ? text('hasStartingBlocks') : undefined),
            changes.initialProgram ? <>
                <Typography variant="body2">{text('studentStarts')}</Typography>
                <SolutionProgramView program={changes.initialProgram} />
            </> : plain(text('removeStartingBlocks')))}
        {changes.previewProgram && field('previewProgram', <SolutionProgramView program={changes.previewProgram} />)}
    </>

    const testResult = () => {
        const { tested } = review
        if (!tested) return (changes.maps || changes.toolbox || changes.assesments) &&
            <Alert severity="info" data-testid="ai-proposal-not-tested">{text('notTested')}</Alert>

        const solved = tested.scenarios.every(scenario => scenario.solved)
        return <>
            <Alert severity={solved ? 'success' : 'error'} data-testid={solved ? 'ai-proposal-solved' : 'ai-proposal-unsolved'}>
                <Typography variant="body2">{text(solved ? 'solved' : 'unsolved')}</Typography>
                {tested.scenarios.length > 1 && tested.scenarios.map(({ index, solved }) =>
                    <Typography key={index} variant="body2">{solverText(solved ? 'scenarioOk' : 'scenarioFail', { number: index + 1 })}</Typography>)}
            </Alert>
            {tested.warnings.length > 0 && <Alert severity="warning" data-testid="ai-proposal-warnings">
                <Typography variant="body2" fontWeight="bold">{solverText('warningsTitle')}</Typography>
                {tested.warnings.map((warning, i) => <Typography key={i} variant="body2">{warningText(warning)}</Typography>)}
            </Alert>}
        </>
    }

    // No onClose: leaving the dialog has to be a decision.
    return <Dialog open maxWidth="md" fullWidth aria-labelledby="ai-proposal-title" data-testid="ai-proposal">
        <DialogTitle id="ai-proposal-title" sx={{ fontWeight: 'bold' }}>{text('title')}</DialogTitle>
        <DialogContent>
            <Stack spacing={2}>
                {plain(proposal.summary)}
                {review.valid ? <>{testResult()}{changedFields()}</> :
                    <Alert severity="error" data-testid="ai-proposal-invalid">{text('invalid')}</Alert>}
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button onClick={reject} data-testid="ai-proposal-reject">{text('reject')}</Button>
            <Button variant="contained" onClick={apply} disabled={!review.valid} data-testid="ai-proposal-apply">{text('apply')}</Button>
        </DialogActions>
    </Dialog>
}
