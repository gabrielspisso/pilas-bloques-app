import { AutoAwesome } from "@mui/icons-material"
import { Button, ListItemText, ListSubheader, Menu, MenuItem } from "@mui/material"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { LocalStorage } from "../../../localStorage"
import { SceneType } from "../../serializedChallenge"
import { challengeFromTemplate, templatesFor } from "../templates"

/** Offers starting from a sample challenge of the selected character instead of an empty board. */
export const TemplatesButton = ({ type }: { type: SceneType }) => {
    const { t } = useTranslation("creator")
    const navigate = useNavigate()
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)
    const templates = templatesFor(type)

    if (!templates.length) return <></>

    const start = (index: number) => {
        LocalStorage.saveCreatorChallenge(challengeFromTemplate(templates[index], key => t(key)))
        navigate("/creador/editar")
    }

    return <>
        <Button variant="contained" color="primary" startIcon={<AutoAwesome aria-hidden />} data-testid="templates-button"
            aria-haspopup="menu" aria-expanded={!!anchor} onClick={event => setAnchor(event.currentTarget)}
            sx={{ textTransform: 'none', fontWeight: 'bold', minHeight: 44, marginBottom: 1 }}>
            {t("selection.templatesButton")}
        </Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} data-testid="templates-menu"
            MenuListProps={{ subheader: <ListSubheader>{t("selection.templatesTitle", { name: t(`selection.cards.${type}.name`) })}</ListSubheader> }}>
            {templates.map((template, index) =>
                <MenuItem key={template.id} onClick={() => start(index)} data-testid={`template-${template.id}`} sx={{ maxWidth: 360, whiteSpace: 'normal' }}>
                    <ListItemText primary={t(`selection.templates.${template.id}.title`)} secondary={t(`selection.templates.${template.id}.statement`)} />
                </MenuItem>)}
        </Menu>
    </>
}
