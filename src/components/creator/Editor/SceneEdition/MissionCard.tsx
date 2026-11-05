import { SportsScore } from "@mui/icons-material"
import { Stack, Typography } from "@mui/material"
import { useContext } from "react"
import { useTranslation } from "react-i18next"
import { LocalStorage } from "../../../../localStorage"
import { useThemeContext } from "../../../../theme/ThemeContext"
import { SceneType } from "../../../serializedChallenge"
import { missionFor } from "../../sceneGoals"
import { CreatorContext } from "../CreatorContext"

/**
 * Shows what the actor has to do in the current scenario, derived from the objects on the board.
 */
export const MissionCard = () => {
    const { t } = useTranslation('creator')
    const { theme } = useThemeContext()
    const { currentMap } = useContext(CreatorContext)

    const sceneType: SceneType = LocalStorage.getCreatorChallenge()?.scene.type || 'Duba'
    const mission = missionFor(sceneType, currentMap)

    return <Stack component="section" aria-labelledby="mission-title" data-testid="mission-card"
        sx={{ width: '100%', paddingX: theme.spacing(2), paddingY: theme.spacing(1) }}>
        <Typography id="mission-title" variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SportsScore aria-hidden />{t('editor.mission.title')}
        </Typography>
        {mission.length === 0
            ? <Typography variant="body2" data-testid="mission-empty">{t('editor.mission.empty')}</Typography>
            : <>
                <Typography variant="body2">{t('editor.mission.intro', { actor: t(`selection.cards.${sceneType}.name`) })}</Typography>
                <Stack component="ul" direction="row" flexWrap="wrap" sx={{ listStyle: 'none', padding: 0, margin: 0, columnGap: 2, rowGap: 0.5 }}>
                    {mission.map(goal =>
                        <Typography component="li" variant="body2" key={goal.cell} data-testid={`mission-goal-${goal.cell}`}
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <img src={`imagenes/sceneImages/${sceneType}/${goal.cell}.png`} alt="" width={28} height={28} style={{ objectFit: 'contain' }} />
                            {t(`selection.cards.${sceneType}.goals.${goal.key}`)}
                            <strong>{t('editor.mission.count', { count: goal.count })}</strong>
                        </Typography>)}
                </Stack>
            </>}
    </Stack>
}
