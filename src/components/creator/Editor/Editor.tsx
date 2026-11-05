import { Box, Stack } from "@mui/material";
import { ChallengeHeaderEdition } from "./ChallengeDetailsEdition/ChallengeHeaderEdition";
import { Header, HeaderText } from "../../header/Header";
import { SceneEdition } from "./SceneEdition/SceneEdition";
import { CreatorContextProvider } from "./CreatorContext";
import { CreatorSubHeader } from "./EditorSubHeader/CreatorSubHeader";
import { useTranslation } from "react-i18next";
import { DiscardChallengeButton } from "./ActionButtons/DiscardChallengeButton";
import { EmberPreviewButton } from "./ActionButtons/EmberPreviewButton";
import { PreviewButton } from "./ActionButtons/PreviewButton";
import { BetaBadge } from "../BetaBadge";
import { useThemeContext } from "../../../theme/ThemeContext";
import { useNavigate } from "react-router-dom";
import { LocalStorage } from "../../../localStorage";
import { useEffect } from "react";
import { ShareButton } from "./ActionButtons/ShareChallenge/ShareButton";
import { UndoRedoButtons } from "./EditorSubHeader/UndoRedoButtons";
import { CreatorThemeProvider, creatorPageBackground } from "../../../theme/creatorTheme";

export const CreatorEditor = () => {
  const { darkModeEnabled } = useThemeContext()

  const { t } = useTranslation('creator')

  const navigate = useNavigate()

  const challengeExists = LocalStorage.getCreatorChallenge()

  const shouldShow = process.env.NODE_ENV !== 'production'

  useEffect(() => {
    if (!challengeExists) navigate('/creador/seleccionar')
  }, [challengeExists, navigate])

  return (
    <>
      {challengeExists ?
        (<CreatorContextProvider>
          <CreatorThemeProvider>
          <Stack alignItems="center" height="inherit" sx={{ backgroundColor: creatorPageBackground(darkModeEnabled) }}>
            <Header CenterComponent={<HeaderText text={t("editor.editorHeader")} />}
              SubHeader={<EditorSubHeader viewButton={shouldShow ? <EmberPreviewButton /> : undefined} reactViewButton={<PreviewButton />} showHistory />} />
            <Stack width="100%" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <ChallengeHeaderEdition />
              <Box sx={{ flex: 1, minHeight: 360 }}>
                <SceneEdition />
              </Box>
            </Stack>
          </Stack>
          </CreatorThemeProvider>
        </CreatorContextProvider>
        ) : <></>}
    </>

  )
}

type EditorSubHeaderProps = {
  viewButton: React.ReactNode
  reactViewButton?: React.ReactNode
  showHistory?: boolean
}

export const EditorSubHeader = (props: EditorSubHeaderProps) =>
  <CreatorSubHeader>
    <DiscardChallengeButton />
    {props.showHistory && <UndoRedoButtons />}
    {props.viewButton}
    {props.reactViewButton}
    <ShareButton />
  </CreatorSubHeader>
