import { CheckCircle, RadioButtonUnchecked } from "@mui/icons-material"
import { Stack, Typography } from "@mui/material"
import { useContext } from "react"
import { useTranslation } from "react-i18next"
import { LocalStorage } from "../../../../../localStorage"
import { useThemeContext } from "../../../../../theme/ThemeContext"
import { ChecklistItem, missingItems, publishChecklist } from "../../../publishChecklist"
import { CreatorContext } from "../../CreatorContext"

/**
 * Live requirements to publish. Title, statement and maps come from CreatorContext (LocalStorage
 * is only written after render); the toolbox is saved straight to LocalStorage by ToolBoxEditor.
 */
export const usePublishChecklist = () => {
    const { title, statement, maps } = useContext(CreatorContext)
    const { t } = useTranslation('creator')
    const saved = LocalStorage.getCreatorChallenge()
    const challenge = saved && { ...saved, title, statement: { ...saved.statement, description: statement }, scene: { ...saved.scene, maps } }
    const items = publishChecklist(challenge, {
        title: t('statement.defaultTitle')!,
        statement: t('statement.defaultDescription')!
    })
    const missing = missingItems(items)
    const disabledReason = missing.length
        ? t('editor.checklist.missing', { items: missing.map(item => t(`editor.checklist.items.${item.id}`)).join(', ') })
        : ''
    return { items, missing, disabledReason }
}

export const PublishChecklist = ({ items, disabledReason }: { items: ChecklistItem[], disabledReason: string }) => {
    const { t } = useTranslation('creator')
    const { theme } = useThemeContext()

    return <Stack component="section" aria-labelledby="publish-checklist-title" data-testid="publish-checklist" sx={{ marginBottom: 1 }}>
        <Typography id="publish-checklist-title" variant="subtitle1" fontWeight="bold">{t('editor.checklist.title')}</Typography>
        <Stack component="ul" sx={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map(item =>
                <Typography component="li" variant="body2" key={item.id} data-testid={`checklist-${item.id}`} data-ok={item.ok}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 32 }}>
                    {item.ok
                        ? <CheckCircle aria-hidden sx={{ color: theme.palette.success.dark }} />
                        : <RadioButtonUnchecked aria-hidden sx={{ color: theme.palette.text.primary }} />}
                    <span>{t(`editor.checklist.items.${item.id}`)}</span>
                    <Typography component="span" variant="body2" sx={visuallyHidden}>
                        {`(${item.ok ? t('editor.checklist.done') : t('editor.checklist.pending')})`}
                    </Typography>
                </Typography>)}
        </Stack>
        <Typography variant="body2" role="status" data-testid="checklist-status" sx={{ marginTop: 1, fontWeight: 600 }}>
            {disabledReason || t('editor.checklist.ready')}
        </Typography>
    </Stack>
}

const visuallyHidden = {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0
} as const
