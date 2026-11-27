import { Close, ExpandLess, ExpandMore, Notes } from "@mui/icons-material";
import { Box, Button, Collapse, IconButton, Stack, Tab, Tabs, TextField, Tooltip } from "@mui/material";
import { useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "../../../../theme/ThemeContext";
import { StatementDescription } from "../../../challengeView/StatementDescription";
import { PBCard } from "../../../PBCard";
import { CreatorContext } from "../CreatorContext";
import { MarkdownInput } from "../MarkDownEdition/MarkdownInput";
import { LocalStorage } from "../../../../localStorage";

export const TITLE_MAX_LENGTH = 80
/** The counter shows while the title is focused or when this many characters (or fewer) are left. */
export const TITLE_COUNTER_THRESHOLD = 10

/**
 * Collapsed header sizes (px). The row is the only thing visible when collapsed, so the
 * collapsed header is row + vertical margins: 52 + 2*4 = 60 on desktop, 44 + 2*2 = 48 on mobile.
 */
export const HEADER_ROW_HEIGHT_PX = { desktop: 52, mobile: 44 }
export const HEADER_MARGIN_Y_PX = { desktop: 4, mobile: 2 }
export const TITLE_FONT_SIZE_PX = { desktop: 20, mobile: 18 }
/** The expanded statement panel never takes more than this, it scrolls inside. */
export const STATEMENT_PANEL_MAX_HEIGHT = 'min(50vh, 420px)'

export const collapsedHeaderHeight = (isSmallScreen: boolean) => {
    const size = isSmallScreen ? 'mobile' : 'desktop'
    return HEADER_ROW_HEIGHT_PX[size] + 2 * HEADER_MARGIN_Y_PX[size]
}

export const shouldShowTitleCounter = (length: number, focused: boolean, max = TITLE_MAX_LENGTH, threshold = TITLE_COUNTER_THRESHOLD) =>
    focused || max - length <= threshold

/** One plain-text line out of the Markdown statement, for the collapsed summary. */
export const statementSummary = (statement: string): string =>
    statement
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')       // images
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // links keep their text
        .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // headings, quotes, list markers
        .replace(/[*_`~]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

const visuallyHidden: React.CSSProperties = {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden',
    clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0
}

/**
 * Compact header: one low row with the title (one line) and a one-line summary of the statement.
 * The statement opens in a panel below (tabs "Write" / "Preview", optional clue inside), closed with
 * its button or Escape. Everything autosaves through CreatorContext (which persists to LocalStorage).
 */
export const ChallengeHeaderEdition = () => {
    const { t } = useTranslation('creator')
    const { theme, isSmallScreen } = useThemeContext()
    const { title, setTitle, statement, setStatement, clue, setClue } = useContext(CreatorContext)

    const [expanded, setExpanded] = useState(false)
    const [tab, setTab] = useState<'write' | 'preview'>('write')
    const [titleFocused, setTitleFocused] = useState(false)

    const toggleRef = useRef<HTMLButtonElement | null>(null)
    const statementButtonRef = useRef<HTMLButtonElement | null>(null)
    const clueButtonRef = useRef<HTMLButtonElement | null>(null)

    const sceneType = LocalStorage.getCreatorChallenge()?.scene.type
    const size = isSmallScreen ? 'mobile' : 'desktop'

    const summaryText = statementSummary(statement)
    const summary = summaryText ? t('editor.header.statementSummary', { text: summaryText }) : t('editor.header.statementEmpty')
    const showCounter = shouldShowTitleCounter(title.length, titleFocused)

    const close = () => {
        setExpanded(false)
        toggleRef.current?.focus()
    }

    const handlePanelKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.stopPropagation()
            close()
        }
    }

    return <PBCard role="region" aria-label={t('editor.header.region')!} data-testid="challenge-header"
        sx={{
            flexDirection: 'column', alignItems: 'stretch', flexShrink: 0,
            marginY: `${HEADER_MARGIN_Y_PX[size]}px`, marginX: theme.spacing(isSmallScreen ? 0.5 : 1),
            paddingX: theme.spacing(isSmallScreen ? 1 : 2)
        }}>
        <Stack direction="row" alignItems="center" gap={isSmallScreen ? 1 : 2} data-testid="challenge-header-row"
            sx={{ height: HEADER_ROW_HEIGHT_PX[size], minWidth: 0 }}>
            <label htmlFor="challenge-title-input" style={visuallyHidden}>{t('title.input')}</label>
            <span id="challenge-title-help" style={visuallyHidden}>{t('title.helper')}</span>
            <TextField
                variant="standard"
                id="challenge-title-input"
                value={title}
                placeholder={t('title.input')!}
                onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
                onFocus={() => setTitleFocused(true)}
                onBlur={() => setTitleFocused(false)}
                inputProps={{ maxLength: TITLE_MAX_LENGTH, 'data-testid': 'title-input', 'aria-describedby': 'challenge-title-help challenge-title-counter' }}
                InputProps={{
                    sx: { fontSize: TITLE_FONT_SIZE_PX[size], fontWeight: 700 },
                    endAdornment: <Box component="span" id="challenge-title-counter" data-testid="title-counter"
                        style={{ visibility: showCounter ? 'visible' : 'hidden' }}
                        sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', marginLeft: 1 }}>
                        {t('title.counter', { count: title.length, max: TITLE_MAX_LENGTH })}
                    </Box>
                }}
                sx={{ flex: '1 1 55%', minWidth: 0, maxWidth: 560 }}
            />
            <Tooltip title={expanded ? t('editor.header.collapse') : t('editor.header.expand')}>
                <Button ref={toggleRef} onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="challenge-statement-panel"
                    data-testid="challenge-header-toggle" startIcon={<Notes />} endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
                    sx={{ flex: '1 1 45%', minWidth: 0, minHeight: 44, textTransform: 'none', justifyContent: 'flex-start', color: 'text.primary' }}>
                    <Box component="span" data-testid="statement-summary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                        {summary}
                    </Box>
                </Button>
            </Tooltip>
        </Stack>
        <Collapse in={expanded} unmountOnExit>
            <Box id="challenge-statement-panel" role="group" aria-label={t('editor.header.panel')!} data-testid="statement-panel"
                onKeyDown={handlePanelKeyDown}
                sx={{ maxHeight: STATEMENT_PANEL_MAX_HEIGHT, overflowY: 'auto', paddingBottom: 1 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label={t('editor.header.panel')!}>
                        <Tab value="write" label={t('editor.header.writeTab')} id="statement-tab-write" aria-controls="statement-tabpanel" data-testid="statement-tab-write" />
                        <Tab value="preview" label={t('editor.header.previewTab')} id="statement-tab-preview" aria-controls="statement-tabpanel" data-testid="statement-tab-preview" />
                    </Tabs>
                    <Tooltip title={t('editor.header.closePanel')}>
                        <IconButton onClick={close} aria-label={t('editor.header.closePanel')!} data-testid="statement-panel-close" sx={{ minWidth: 44, minHeight: 44 }}>
                            <Close />
                        </IconButton>
                    </Tooltip>
                </Stack>
                <Box role="tabpanel" id="statement-tabpanel" aria-labelledby={`statement-tab-${tab}`}>
                    {tab === 'write'
                        ? <MarkdownInput
                            statement={statement} setStatement={setStatement}
                            clue={clue} setClue={setClue}
                            statementButtonRef={statementButtonRef} clueButtonRef={clueButtonRef} />
                        : <Box translate="no" data-testid="statement-preview">
                            <StatementDescription
                                statementButtonRef={statementButtonRef}
                                clueButtonRef={clueButtonRef}
                                statement={statement}
                                clue={clue}
                                clueIsEnabled={clue !== undefined}
                                urlImage={`imagenes/sceneImages/${sceneType}/tool.png`} />
                        </Box>}
                </Box>
            </Box>
        </Collapse>
    </PBCard>
}
