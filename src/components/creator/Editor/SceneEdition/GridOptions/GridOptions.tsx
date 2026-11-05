import { Stack } from "@mui/material";
import { GridSizePicker } from "./GridSizePicker";
import { PBCard } from "../../../../PBCard";
import { ScenarioEditionButtons } from "./ScenarioEditionButtons";
import { useThemeContext } from "../../../../../theme/ThemeContext";
import { ToolBoxEditor } from "../../ChallengeDetailsEdition/ToolBoxEditor/ToolBoxEditor";
import { AssessmentsEdition } from "../../ChallengeDetailsEdition/AssessmentsEdition";

export const GridOptions = () => {
    const { theme } = useThemeContext()


    return <>
        <Stack>
            <PBCard sx={{justifyContent: "center"}}>
                <Stack sx={{padding: theme.spacing(1), maxWidth: "200px", paddingBottom: 5, paddingTop: 4, gap: theme.spacing(1)}}>
                    <GridSizePicker />
                    <ScenarioEditionButtons/>
                </Stack>
            </PBCard>
                <ToolBoxEditor/>
                <AssessmentsEdition/>
            {/*<Button>Bloques iniciales</Button> Not in the MVP*/}
        </Stack>
    </>
}