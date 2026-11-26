import { ContentCopy, DeleteOutline, Link, LinkOff, SmartToy } from "@mui/icons-material"
import { CardActionArea, Chip, Divider, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Stack, Tooltip, Typography } from "@mui/material"
import { useCallback, useContext, useState } from "react"
import { useTranslation } from "react-i18next"
import { useThemeContext } from "../../../theme/ThemeContext"
import { PBCard } from "../../PBCard"
import { CreatorContext } from "../Editor/CreatorContext"
import { useAiSession } from "./AiSessionProvider"
import { ConnectAssistantDialog, copyText } from "./ConnectAssistantDialog"

const EXAMPLES = ['solve', 'texts', 'level']

/** Visible in the whole creator while the challenge is shared with an assistant. */
export const AiSharingIndicator = () => {
    const { t } = useTranslation('creator')
    const { status, client } = useAiSession()

    if (status !== 'connected') return null

    return <Chip icon={<SmartToy />} color="secondary" size="small" data-testid="ai-indicator" role="status"
        label={t('ai.menu.sharing', { client, interpolation: { escapeValue: false } })} />
}

/** Card with the menu of the AI features. */
export const AiFunctions = () => {
    const { t } = useTranslation('creator')
    const { theme, isSmallScreen } = useThemeContext()
    const { status, client, error, disconnect } = useAiSession()
    const { initialSolution, setInitialSolution, keepVersion } = useContext(CreatorContext)
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)
    const [connecting, setConnecting] = useState(false)
    const closeDialog = useCallback(() => setConnecting(false), [])

    const connected = status === 'connected'

    const choose = (action: () => void) => () => {
        setAnchor(null)
        action()
    }

    const item = (testId: string, icon: React.ReactNode, label: string, action: () => void) =>
        <MenuItem key={testId} data-testid={testId} onClick={choose(action)} sx={{ whiteSpace: 'normal' }}>
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText>{label}</ListItemText>
        </MenuItem>

    const removeInitialBlocks = () => {
        keepVersion()
        setInitialSolution(undefined)
    }

    return <>
        <PBCard sx={{ padding: theme.spacing(1), flexGrow: "1" }}>
            <Tooltip title={isSmallScreen ? t('ai.button') : ''}>
                <CardActionArea onClick={event => setAnchor(event.currentTarget)} data-testid="ai-button" aria-label={t('ai.button')!} aria-haspopup="menu">
                    <Stack alignItems="center">
                        <SmartToy aria-hidden sx={{ fontSize: 44, color: 'primary.main' }} />
                        {!isSmallScreen && <Typography variant="body2" textAlign="center">{t('ai.button')}</Typography>}
                        {connected && <Typography variant="caption">{t('ai.connected')}</Typography>}
                        {error === 'lost' && <Typography variant="caption" color="error" textAlign="center" data-testid="ai-lost">{t('ai.errors.lost')}</Typography>}
                    </Stack>
                </CardActionArea>
            </Tooltip>
        </PBCard>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} PaperProps={{ sx: { maxWidth: 360 } }}>
            {connected ? [
                <ListSubheader key="sharing" sx={{ lineHeight: 2, paddingY: 1 }}>
                    {t('ai.menu.sharing', { client, interpolation: { escapeValue: false } })}
                    <Typography variant="caption" display="block">{t('ai.menu.examples')}</Typography>
                </ListSubheader>,
                ...EXAMPLES.map(example => item(`ai-menu-example-${example}`, <ContentCopy fontSize="small" />, t(`ai.examples.${example}`),
                    () => copyText(t(`ai.examples.${example}`)))),
                <Divider key="divider" />,
                item('ai-menu-stop', <LinkOff fontSize="small" />, t('ai.menu.stop'), disconnect)
            ] : item('ai-menu-connect', <Link fontSize="small" />, t('ai.menu.connect'), () => setConnecting(true))}
            {initialSolution !== undefined && item('ai-menu-remove-initial', <DeleteOutline fontSize="small" />, t('ai.menu.removeInitial'), removeInitialBlocks)}
        </Menu>
        {connecting && <ConnectAssistantDialog onClose={closeDialog} />}
    </>
}
