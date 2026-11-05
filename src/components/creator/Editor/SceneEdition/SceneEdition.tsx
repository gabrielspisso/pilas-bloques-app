import { Stack } from "@mui/material";
import { SceneTools } from "./SceneTools";
import { GridOptions } from "./GridOptions/GridOptions";
import { Scenarios } from "./Grid/Scenarios";
import { SceneDragProvider } from "./SceneDrag";

export const SceneEdition = () =>
    <SceneDragProvider>
        <Stack direction="row" alignItems="stretch" sx={{ height: "100%" }}>
            <GridOptions />
            <Scenarios />
            <SceneTools />
        </Stack>
    </SceneDragProvider>
