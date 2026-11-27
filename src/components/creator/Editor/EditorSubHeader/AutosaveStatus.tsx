import { CloudDone, History } from "@mui/icons-material";
import { Button, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreatorVersion, LocalStorage } from "../../../../localStorage";
import { useThemeContext } from "../../../../theme/ThemeContext";
import { CreatorContext } from "../CreatorContext";

const formatTime = (time: number, language: string) => {
    try {
        return new Date(time).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
    } catch (e) {
        return new Date(time).toLocaleTimeString()
    }
}

/** Discreet "saved" indicator; its menu lists the last versions kept in this browser and restores one. */
export const AutosaveStatus = () => {
    const { t, i18n } = useTranslation('creator')
    const { isSmallScreen } = useThemeContext()
    const { lastSavedAt, loadChallenge } = useContext(CreatorContext)
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)
    const [versions, setVersions] = useState<CreatorVersion[]>([])

    const sceneType = LocalStorage.getCreatorChallenge()?.scene.type
    const status = lastSavedAt ? t('editor.autosave.savedAt', { time: formatTime(lastSavedAt, i18n.language) }) : t('editor.autosave.saved')

    const openMenu = (event: React.MouseEvent<HTMLElement>) => {
        // Newest first; only versions of this character can be loaded in this editor.
        setVersions(LocalStorage.getCreatorVersions().filter(version => version.challenge.scene.type === sceneType).reverse())
        setAnchor(event.currentTarget)
    }

    const restore = (version: CreatorVersion) => {
        loadChallenge(version.challenge)
        setAnchor(null)
    }

    return <>
        <Button onClick={openMenu} data-testid="autosave-status" aria-haspopup="menu" aria-expanded={!!anchor}
            aria-label={`${status}. ${t('editor.autosave.versions')}`}
            startIcon={<CloudDone aria-hidden />} color="inherit"
            sx={{ textTransform: 'none', whiteSpace: 'nowrap', fontWeight: 400, opacity: 0.85, minWidth: 44 }}>
            <Typography component="span" variant="body2" role="status" aria-live="polite" data-testid="autosave-text"
                sx={isSmallScreen ? visuallyHidden : undefined}>{status}</Typography>
        </Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} data-testid="versions-menu">
            <MenuItem disabled sx={{ opacity: '1 !important' }}><History aria-hidden sx={{ marginRight: 1 }} />{t('editor.autosave.versions')}</MenuItem>
            {versions.length === 0 && <MenuItem disabled>{t('editor.autosave.noVersions')}</MenuItem>}
            {versions.map(version =>
                <MenuItem key={version.savedAt} onClick={() => restore(version)} data-testid="version-item">
                    <ListItemText primary={t('editor.autosave.restore', { time: formatTime(version.savedAt, i18n.language) })}
                        secondary={version.challenge.title || t('editor.autosave.untitled')} />
                </MenuItem>)}
        </Menu>
    </>
}

const visuallyHidden = {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0
} as const
