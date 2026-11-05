import { Box, Stack, Tab, Tabs, useMediaQuery } from "@mui/material";
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
import { useEffect, useState } from "react";
import { ShareButton } from "./ActionButtons/ShareChallenge/ShareButton";
import { UndoRedoButtons } from "./EditorSubHeader/UndoRedoButtons";
import { AutosaveStatus } from "./EditorSubHeader/AutosaveStatus";
import { CreatorThemeProvider, creatorPageBackground } from "../../../theme/creatorTheme";
import { CreatorMode, CreatorModeSwitch, SIDE_BY_SIDE_MIN_WIDTH, useCreatorMode } from "./CreatorMode";
import { CreatorLivePreview } from "./CreatorLivePreview";

export const CreatorEditor = () => {
  const { darkModeEnabled } = useThemeContext()

  const { t } = useTranslation('creator')

  const navigate = useNavigate()

  const challengeExists = LocalStorage.getCreatorChallenge()

  const shouldShow = process.env.NODE_ENV !== 'production'

  const [mode, setMode] = useCreatorMode()

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
              SubHeader={<EditorSubHeader viewButton={shouldShow ? <EmberPreviewButton /> : undefined} reactViewButton={<PreviewButton />} showHistory
                modeSwitch={<CreatorModeSwitch mode={mode} onChange={setMode} />} />} />
            <CreatorWorkspace mode={mode} />
          </Stack>
          </CreatorThemeProvider>
        </CreatorContextProvider>
        ) : <></>}
    </>

  )
}

const EditionPanel = () =>
  <Stack width="100%" data-testid="creator-edition-panel" sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto' }}>
    <ChallengeHeaderEdition />
    <Box sx={{ flex: 1, minHeight: 360 }}>
      <SceneEdition />
    </Box>
  </Stack>

/**
 * "editor": only the edition panel, the scene engine is not loaded.
 * "test": edition panel and live preview side by side from SIDE_BY_SIDE_MIN_WIDTH, two tabs below it.
 * Both modes read the same CreatorContext, so switching keeps the selected tool, scenario and texts.
 */
export const CreatorWorkspace = ({ mode }: { mode: CreatorMode }) => {
  const { t } = useTranslation('creator')
  const sideBySide = useMediaQuery(`(min-width:${SIDE_BY_SIDE_MIN_WIDTH}px)`)
  const [tab, setTab] = useState<'edit' | 'try'>('edit')

  if (mode === 'editor') return <EditionPanel />

  if (sideBySide) return <Stack direction="row" width="100%" spacing={1} sx={{ flex: 1, minHeight: 0, padding: 1 }}>
    <EditionPanel />
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}><CreatorLivePreview /></Box>
  </Stack>

  return <Stack width="100%" sx={{ flex: 1, minHeight: 0 }}>
    <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" aria-label={t('editor.mode.tabsLabel')!}
      sx={{ backgroundColor: 'background.paper' }}>
      <Tab value="edit" label={t('editor.mode.editTab')} id="creator-tab-edit" aria-controls="creator-tabpanel" data-testid="creator-tab-edit" />
      <Tab value="try" label={t('editor.mode.tryTab')} id="creator-tab-try" aria-controls="creator-tabpanel" data-testid="creator-tab-try" />
    </Tabs>
    <Stack role="tabpanel" id="creator-tabpanel" aria-labelledby={`creator-tab-${tab}`} sx={{ flex: 1, minHeight: 0 }}>
      {tab === 'edit' ? <EditionPanel /> : <CreatorLivePreview />}
    </Stack>
  </Stack>
}

type EditorSubHeaderProps = {
  viewButton: React.ReactNode
  reactViewButton?: React.ReactNode
  showHistory?: boolean
  modeSwitch?: React.ReactNode
}

export const EditorSubHeader = (props: EditorSubHeaderProps) =>
  <CreatorSubHeader>
    <DiscardChallengeButton />
    {props.showHistory && <UndoRedoButtons />}
    {props.showHistory && <AutosaveStatus />}
    {props.modeSwitch}
    {props.viewButton}
    {props.reactViewButton}
    <ShareButton />
  </CreatorSubHeader>
