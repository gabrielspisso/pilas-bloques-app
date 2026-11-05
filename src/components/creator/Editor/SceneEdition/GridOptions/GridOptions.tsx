import { Stack } from "@mui/material";
import { GridSizePicker } from "./GridSizePicker";
import { PBCard } from "../../../../PBCard";
import { ScenarioEditionButtons } from "./ScenarioEditionButtons";
import { useThemeContext } from "../../../../../theme/ThemeContext";
import { ToolBoxEditor } from "../../ChallengeDetailsEdition/ToolBoxEditor/ToolBoxEditor";
import { AssessmentsEdition } from "../../ChallengeDetailsEdition/AssessmentsEdition";

/** Board options. A column beside the board on wide screens, a wrapping row below it on small ones. */
export const GridOptions = () => {
    const { theme, isSmallScreen } = useThemeContext()

    return <Stack direction={isSmallScreen ? "row" : "column"} flexWrap={isSmallScreen ? "wrap" : "nowrap"} data-testid="grid-options"
        sx={{ flexShrink: 0, minWidth: 0 }}>
        <PBCard sx={{ justifyContent: "center" }}>
            <Stack direction={isSmallScreen ? "row" : "column"} alignItems="center"
                sx={{ padding: theme.spacing(1), maxWidth: isSmallScreen ? undefined : "200px", paddingBottom: isSmallScreen ? 1 : 5, paddingTop: isSmallScreen ? 1 : 4, gap: theme.spacing(1) }}>
                <GridSizePicker />
                <ScenarioEditionButtons />
            </Stack>
        </PBCard>
        <ToolBoxEditor />
        <AssessmentsEdition />
        {/*<Button>Bloques iniciales</Button> Not in the MVP*/}
    </Stack>
}
