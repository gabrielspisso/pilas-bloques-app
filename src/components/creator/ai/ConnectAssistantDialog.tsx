import { ContentCopy } from "@mui/icons-material"
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { LocalStorage } from "../../../localStorage"
import { useAiSession } from "./AiSessionProvider"
import { ASSISTANTS, DEFAULT_MCP_FOLDER, commandsFor } from "./assistants"
import { DEFAULT_PORT } from "./protocol"

export const copyText = (text: string) => navigator.clipboard?.writeText(text)

const FIRST_REQUEST = 'Connect to Pilas Bloques'

const Command = ({ id, command }: { id: string, command: string }) => {
    const { t } = useTranslation('creator')

    return <Stack direction="row" alignItems="center" spacing={1}>
        <Box component="code" sx={{ flex: 1, minWidth: 0, padding: 1, borderRadius: 1, backgroundColor: 'action.hover', overflowWrap: 'anywhere' }}>
            {command}
        </Box>
        <Tooltip title={t('ai.copy')}>
            <IconButton onClick={() => copyText(command)} aria-label={t('ai.copy')!} data-testid={`ai-copy-${id}`}>
                <ContentCopy fontSize="small" />
            </IconButton>
        </Tooltip>
    </Stack>
}

/** The guide to install an assistant and the field for the pairing code. */
export const ConnectAssistantDialog = ({ onClose }: { onClose: () => void }) => {
    const { t } = useTranslation('creator')
    const { status, error, connect, disconnect } = useAiSession()
    const [assistantId, setAssistantId] = useState(ASSISTANTS[0].id)
    const [folder, setFolder] = useState(() => LocalStorage.getAiMcpFolder() ?? DEFAULT_MCP_FOLDER)
    const [code, setCode] = useState('')

    const assistant = ASSISTANTS.find(({ id }) => id === assistantId)!
    const commands = commandsFor(assistant, folder)
    const connecting = status === 'connecting'

    useEffect(() => {
        if (status === 'connected') onClose()
    }, [status, onClose])

    const close = () => {
        if (connecting) disconnect()
        onClose()
    }

    const changeFolder = (value: string) => {
        setFolder(value)
        LocalStorage.saveAiMcpFolder(value)
    }

    const step = (number: number, content: React.ReactNode) =>
        <Stack spacing={1}>
            <Typography variant="body2" fontWeight="bold">{number}. {t(`ai.connect.steps.${number}`, { assistant: assistant.name })}</Typography>
            {content}
        </Stack>

    return <Dialog open onClose={close} maxWidth="sm" fullWidth aria-labelledby="ai-connect-title" data-testid="ai-connect">
        <DialogTitle id="ai-connect-title" sx={{ fontWeight: 'bold' }}>{t('ai.connect.title')}</DialogTitle>
        <DialogContent>
            <Stack spacing={2}>
                <Typography variant="body2">{t('ai.connect.intro')}</Typography>
                <Tabs value={assistantId} onChange={(_, value) => setAssistantId(value)} variant="fullWidth">
                    {ASSISTANTS.map(({ id, name }) => <Tab key={id} value={id} label={name} data-testid={`ai-tab-${id}`} sx={{ textTransform: 'none' }} />)}
                </Tabs>
                {step(1, <Command id="install" command={commands.install} />)}
                {step(2, <>
                    <TextField size="small" label={t('ai.connect.folder')} value={folder} onChange={event => changeFolder(event.target.value)}
                        inputProps={{ 'data-testid': 'ai-folder', spellCheck: false }} sx={{ marginTop: 1 }} />
                    <Command id="build" command={commands.build} />
                </>)}
                {step(3, <Command id="register" command={commands.register} />)}
                {step(4, <>
                    <Command id="request" command={FIRST_REQUEST} />
                    <TextField size="small" label={t('ai.connect.code')} value={code} onChange={event => setCode(event.target.value)}
                        inputProps={{ 'data-testid': 'ai-code', autoComplete: 'off', spellCheck: false, maxLength: 20 }} />
                </>)}
                <Alert severity="info">{t('ai.connect.privacy')}</Alert>
                {error && <Alert severity="error" data-testid="ai-error">{t(`ai.errors.${error}`, { port: DEFAULT_PORT })}</Alert>}
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button onClick={close} data-testid="ai-connect-close">{t('ai.connect.close')}</Button>
            <Button variant="contained" onClick={() => connect(code)} disabled={connecting || !code.trim()} data-testid="ai-share"
                startIcon={connecting ? <CircularProgress size={16} /> : undefined}>
                {t('ai.connect.share')}
            </Button>
        </DialogActions>
    </Dialog>
}
