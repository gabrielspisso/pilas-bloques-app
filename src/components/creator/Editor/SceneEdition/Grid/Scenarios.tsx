import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import { MobileStepper, Stack, Typography } from "@mui/material";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "../../../../../theme/ThemeContext";
import { PBCard } from "../../../../PBCard";
import { CreatorContext } from "../../CreatorContext";
import { IconButtonTooltip } from "../IconButtonTooltip";
import { SceneGrid } from "./SceneGrid";
import { MissionCard } from "../MissionCard";

/**
 * Board card: one compact row (previous, "Scenario n / N", next), the mission and the board.
 * The arrows live in that row, not beside the board, so the board gets the whole width.
 */
export const Scenarios = () => {
    const { index, maps, setIndex } = useContext(CreatorContext)

    const { theme, isSmallScreen } = useThemeContext()

    const { t } = useTranslation('creator');

    const isFirstMap = index === 0
    const isLastMap = index === maps.length - 1

    return <PBCard sx={{ flex: '1 1 0', minWidth: 0, minHeight: 0, alignItems: 'stretch' }} data-testid="scenarios-card">
        <Stack width='100%' alignItems='center' sx={{ minHeight: 0, minWidth: 0 }}>
            <Stack direction='row' width='100%' alignItems='center' justifyContent='center' gap={1} sx={{ paddingTop: theme.spacing(0.5) }}>
                <IconButtonTooltip sx={{ visibility: isFirstMap ? "hidden" : "visible" }} disabled={isFirstMap} onClick={() => setIndex(index - 1)} icon={<KeyboardArrowLeft />} tooltip={t("mapNavigation.prev")} />
                <Typography variant="subtitle1" fontWeight="bold">{`${isSmallScreen ? '' : t("mapNavigation.multipleInitialScenarios") + ':'} ${index + 1} / ${maps.length}`}</Typography>
                <IconButtonTooltip sx={{ visibility: isLastMap ? "hidden" : "visible" }} disabled={isLastMap} onClick={() => setIndex(index + 1)} icon={<KeyboardArrowRight />} tooltip={t("mapNavigation.next")} />
            </Stack>
            <MissionCard />
            <SceneGrid />
            {maps.length > 1 && <MobileStepper
                variant="dots"
                style={{ padding: theme.spacing(0.5), backgroundColor: 'transparent' }}
                position='static'
                backButton={<span />}
                nextButton={<span />}
                activeStep={index}
                steps={maps.length} />}
        </Stack>
    </PBCard>
}
