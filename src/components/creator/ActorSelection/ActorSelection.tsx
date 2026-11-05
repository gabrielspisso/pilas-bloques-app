import { Stack, useMediaQuery } from "@mui/material"
import { Header, HeaderText } from "../../header/Header"
import { useTranslation } from "react-i18next"
import styles from "./selection.module.css"
import { BetaBadge } from "./../BetaBadge"
import { Actors } from "./Actors"
import { useThemeContext } from "../../../theme/ThemeContext"
import { ChallengeInProgressDialog } from "./InProgressDialog"
import { CreatorThemeProvider, creatorPageBackground } from "../../../theme/creatorTheme"

export const ActorSelection = () =>
    <CreatorThemeProvider>
        <ActorSelectionContent />
    </CreatorThemeProvider>

const ActorSelectionContent = () => {
	const { t } = useTranslation("creator")
    const { theme, darkModeEnabled } = useThemeContext()
    const isSmallScreen: boolean = useMediaQuery(theme.breakpoints.down('md'));

	return (
        <Stack alignItems="center" height="inherit" sx={{backgroundColor: creatorPageBackground(darkModeEnabled)}}>
            <Header CenterComponent={
                <HeaderText text={t("selection.title")}/>}/>
            <ChallengeInProgressDialog />
            <Stack className={styles['selection']}
                   style={isSmallScreen ? {} : {height: "100%"}}>
            <Actors/>
            </Stack>
        </Stack>
)};

