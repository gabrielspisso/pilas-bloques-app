import { Box, Stack } from "@mui/material"
import * as Blockly from "blockly/core"
import { useEffect } from "react"
import { useThemeContext } from "../../theme/ThemeContext"
import { Challenge } from "../../staticData/challenges"
import { SceneView, useBaseSceneSize } from "./SceneView"
import { fittedSceneWidth, sceneHeightFor } from "./sceneSize"
import { useElementSize } from "./useElementSize"

type HorizontalChallengeLayoutProps = {
    descriptor: Challenge["sceneDescriptor"]
    editor: React.ReactNode
    /** Shown above the scene. */
    controls: React.ReactNode
}

/**
 * Editor on the left and scene on the right, both filling the available height.
 * The editor and the scene are absolutely positioned so that their current size never
 * decides the height of the row: otherwise they could grow but not shrink back.
 */
export const HorizontalChallengeLayout = ({ descriptor, editor, controls }: HorizontalChallengeLayoutProps) => {
    const { theme } = useThemeContext()
    const baseSize = useBaseSceneSize()
    const baseWidth = parseInt(baseSize.width)
    const cardMargins = 2 * parseInt(theme.spacing(1))

    const [rowRef, rowSize] = useElementSize()
    const [editorRef, editorSize] = useElementSize()
    const [sceneAreaRef, sceneAreaSize] = useElementSize()

    const sceneWidth = rowSize && sceneAreaSize ?
        fittedSceneWidth(baseWidth, sceneAreaSize.height - cardMargins, rowSize.width) :
        baseWidth

    // Blockly only resizes itself when the window does, but the editor also changes when the scene does.
    useEffect(() => {
        const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg | undefined
        if (editorSize && workspace) Blockly.svgResize(workspace)
    }, [editorSize])

    return <Stack ref={rowRef} data-testid="challenge-row" direction="row" flexGrow={1}>
        <Stack ref={editorRef} data-testid="editor-area" direction="row" position="relative" flexGrow={1} minWidth={0}>
            {editor}
        </Stack>
        <Stack>
            {controls}
            <Box ref={sceneAreaRef} data-testid="scene-area" position="relative" flex="1 1 0"
                width={sceneWidth + cardMargins} minHeight={parseInt(baseSize.height) + cardMargins}>
                <Box position="absolute" top={0} left={0}>
                    <SceneView descriptor={descriptor} size={{ width: `${sceneWidth}px`, height: `${sceneHeightFor(sceneWidth)}px` }} />
                </Box>
            </Box>
        </Stack>
    </Stack>
}
