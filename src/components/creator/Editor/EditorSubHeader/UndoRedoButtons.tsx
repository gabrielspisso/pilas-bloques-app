import { Redo, Undo } from "@mui/icons-material";
import { Stack } from "@mui/material";
import { useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CreatorContext } from "../CreatorContext";
import { IconButtonTooltip } from "../SceneEdition/IconButtonTooltip";

const isTextInput = (target: EventTarget | null) => {
    const element = target as HTMLElement | null
    if (!element || !element.tagName) return false
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
}

/**
 * Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and Ctrl+Y redo.
 * Ignored inside text fields so they keep their native undo.
 */
export const useUndoRedoShortcuts = (undo: () => void, redo: () => void) => {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || isTextInput(event.target)) return
            const key = event.key.toLowerCase()
            if (key === 'z' && !event.shiftKey) {
                event.preventDefault()
                undo()
            } else if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)) {
                event.preventDefault()
                redo()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [undo, redo])
}

export const UndoRedoButtons = () => {
    const { t } = useTranslation('creator')
    const { undo, redo, canUndo, canRedo } = useContext(CreatorContext)

    useUndoRedoShortcuts(undo, redo)

    return <Stack direction='row' alignItems='center'>
        <IconButtonTooltip icon={<Undo />} tooltip={t('editor.history.undoShortcut')} aria-label={t('editor.history.undo')!}
            onClick={undo} disabled={!canUndo} sx={{ opacity: canUndo ? 1 : 0.4 }} data-testid="undo-button" />
        <IconButtonTooltip icon={<Redo />} tooltip={t('editor.history.redoShortcut')} aria-label={t('editor.history.redo')!}
            onClick={redo} disabled={!canRedo} sx={{ opacity: canRedo ? 1 : 0.4 }} data-testid="redo-button" />
    </Stack>
}
