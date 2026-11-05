import { Edit, PlayCircle } from "@mui/icons-material";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LocalStorage } from "../../../localStorage";
import { useThemeContext } from "../../../theme/ThemeContext";

/** "editor": three fluid panels (design A). "test": editable board and playable challenge (design E). */
export type CreatorMode = 'editor' | 'test'

/** Below this width the "test" mode shows two tabs (Edit / Try) instead of two columns. */
export const SIDE_BY_SIDE_MIN_WIDTH = 1200

const isCreatorMode = (value: unknown): value is CreatorMode => value === 'editor' || value === 'test'

/** The chosen mode is remembered between visits. */
export const useCreatorMode = (): [CreatorMode, (mode: CreatorMode) => void] => {
    const saved = LocalStorage.getCreatorMode()
    const [mode, setModeState] = useState<CreatorMode>(isCreatorMode(saved) ? saved : 'editor')
    const setMode = (newMode: CreatorMode) => {
        setModeState(newMode)
        LocalStorage.saveCreatorMode(newMode)
    }
    return [mode, setMode]
}

type CreatorModeSwitchProps = { mode: CreatorMode, onChange: (mode: CreatorMode) => void }

export const CreatorModeSwitch = ({ mode, onChange }: CreatorModeSwitchProps) => {
    const { t } = useTranslation('creator')
    const { isSmallScreen } = useThemeContext()
    const short = isSmallScreen ? 'Short' : ''

    return <ToggleButtonGroup exclusive value={mode} color="primary" size={isSmallScreen ? 'small' : 'medium'}
        aria-label={t('editor.mode.label')!} data-testid="creator-mode-switch"
        onChange={(_, value) => { if (isCreatorMode(value)) onChange(value) }}
        sx={{ backgroundColor: 'background.paper', '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, gap: 0.5, minHeight: 44, paddingX: isSmallScreen ? 1 : 2, whiteSpace: 'nowrap' } }}>
        <ToggleButton value="editor" data-testid="creator-mode-editor">
            <Edit fontSize="small" aria-hidden />{t(`editor.mode.editor${short}`)}
        </ToggleButton>
        <ToggleButton value="test" data-testid="creator-mode-test">
            <PlayCircle fontSize="small" aria-hidden />{t(`editor.mode.test${short}`)}
        </ToggleButton>
    </ToggleButtonGroup>
}
