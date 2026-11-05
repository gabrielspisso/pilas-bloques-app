import { Stack } from "@mui/material";
import { SceneTools } from "./SceneTools";
import { GridOptions } from "./GridOptions/GridOptions";
import { Scenarios } from "./Grid/Scenarios";
import { SceneDragProvider } from "./SceneDrag";
import { useThemeContext } from "../../../../theme/ThemeContext";

/**
 * Wide screens: options | board | palette, side by side.
 * Small screens (< 600 px): palette (one scrollable row) on top, the board with the whole width,
 * and the options in a row below, so the board is not squeezed between two columns.
 */
export const SceneEdition = () => {
    const { isSmallScreen } = useThemeContext()

    return <SceneDragProvider>
        <Stack direction={isSmallScreen ? "column" : "row"} alignItems="stretch" data-testid="scene-edition"
            sx={{ height: "100%", minHeight: 0, minWidth: 0 }}>
            {isSmallScreen
                ? <>
                    <SceneTools />
                    <Scenarios />
                    <GridOptions />
                </>
                : <>
                    <GridOptions />
                    <Scenarios />
                    <SceneTools />
                </>}
        </Stack>
    </SceneDragProvider>
}
