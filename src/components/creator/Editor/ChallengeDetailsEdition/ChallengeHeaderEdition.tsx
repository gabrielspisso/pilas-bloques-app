import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Box, Button, Collapse, Stack, TextField, Typography } from "@mui/material";
import { useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "../../../../theme/ThemeContext";
import { StatementDescription } from "../../../challengeView/StatementDescription";
import { PBCard } from "../../../PBCard";
import { CreatorContext } from "../CreatorContext";
import { MarkdownInput } from "../MarkDownEdition/MarkdownInput";
import { LocalStorage } from "../../../../localStorage";

export const TITLE_MAX_LENGTH = 80

/**
 * "Post-like" header: title, statement (Markdown with live preview) and optional clue,
 * edited in place and autosaved through CreatorContext (which persists to LocalStorage).
 * On small screens it can be collapsed to leave room for the board.
 */
export const ChallengeHeaderEdition = () => {
    const { t } = useTranslation('creator')
    const { theme, isSmallScreen } = useThemeContext()
    const { title, setTitle, statement, setStatement, clue, setClue } = useContext(CreatorContext)

    // null = follow the screen size (collapsed on small screens) until the user decides
    const [userExpanded, setUserExpanded] = useState<boolean | null>(null)
    const expanded = userExpanded ?? !isSmallScreen

    const statementButtonRef = useRef<HTMLButtonElement | null>(null)
    const clueButtonRef = useRef<HTMLButtonElement | null>(null)

    const sceneType = LocalStorage.getCreatorChallenge()?.scene.type

    return <PBCard role="region" aria-label={t('editor.header.region')!} data-testid="challenge-header"
        sx={{ flexDirection: 'column', alignItems: 'stretch', padding: theme.spacing(isSmallScreen ? 1 : 2), flexShrink: 0 }}>
        {isSmallScreen &&
            <Button onClick={() => setUserExpanded(!expanded)} aria-expanded={expanded} aria-controls="challenge-header-fields"
                startIcon={expanded ? <ExpandLess /> : <ExpandMore />} data-testid="challenge-header-toggle"
                sx={{ textTransform: 'none', justifyContent: 'flex-start', minHeight: 44 }}>
                {expanded ? t('editor.header.collapse') : t('editor.header.expand')}
            </Button>}
        <Collapse in={expanded} id="challenge-header-fields">
            <TextField
                fullWidth
                id="challenge-title-input"
                label={t('title.input')}
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
                inputProps={{ maxLength: TITLE_MAX_LENGTH, 'data-testid': 'title-input', 'aria-describedby': 'challenge-title-help' }}
                InputProps={{ sx: { fontSize: '1.5rem', fontWeight: 700 } }}
                FormHelperTextProps={{ id: 'challenge-title-help', component: 'div' } as any}
                helperText={<Stack direction="row" justifyContent="space-between" component="span" gap={1}>
                    <span>{t('title.helper')}</span>
                    <span data-testid="title-counter">{t('title.counter', { count: title.length, max: TITLE_MAX_LENGTH })}</span>
                </Stack>}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ marginTop: theme.spacing(1) }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <MarkdownInput
                        statement={statement} setStatement={setStatement}
                        clue={clue} setClue={setClue}
                        statementButtonRef={statementButtonRef} clueButtonRef={clueButtonRef} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, '& .MuiPaper-root': { height: 96 } }} translate="no" data-testid="statement-preview">
                    <Typography variant="caption" component="h3">{t('statement.preview')}</Typography>
                    <StatementDescription
                        statementButtonRef={statementButtonRef}
                        clueButtonRef={clueButtonRef}
                        statement={statement}
                        clue={clue}
                        clueIsEnabled={clue !== undefined}
                        urlImage={`imagenes/sceneImages/${sceneType}/tool.png`} />
                </Box>
            </Stack>
        </Collapse>
    </PBCard>
}
