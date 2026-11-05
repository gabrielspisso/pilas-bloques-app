import { useContext } from 'react';
import { Stack, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LocalStorage } from '../../../../localStorage';
import { SerializedChallenge, sceneObjectByType } from '../../../serializedChallenge';
import { CreatorContext } from '../CreatorContext';
import { PBCard } from '../../../PBCard';
import { useThemeContext } from '../../../../theme/ThemeContext';
import { useSceneDrag } from './SceneDrag';
import { pieceName } from './boardLabels';


export const SceneTools = () => {
    type ToolProps = {
        id: string
        image?: string
        /** Accessible name: the buttons only show an image */
        label: string
    }
    
    const { theme, isSmallScreen } = useThemeContext()

    const { t } = useTranslation('creator');
    const { selectedTool, setSelectedTool } = useContext(CreatorContext)
    const { startToolDrag } = useSceneDrag()

    const challenge: SerializedChallenge | null = LocalStorage.getCreatorChallenge()

    const selectTool = (e: React.MouseEvent<HTMLElement>) => {
        setSelectedTool(e.currentTarget.id)
    }

    const imagePath = 'imagenes/sceneImages'
    const imagePathScene = `${imagePath}/${challenge?.scene.type}`


    const Tool = (props: ToolProps) => {

        return <Button variant='outlined'
            id={props.id}
            data-testid={props.id}
            aria-label={props.label}
            aria-pressed={props.id === selectedTool}
            onClick={selectTool}
            onPointerDown={(e) => startToolDrag(e, props.id, props.image || '')}
            style={{
                touchAction: 'manipulation', // touch scrolls; holding still starts a drag (SceneDrag)
                WebkitTouchCallout: 'none',
                userSelect: 'none',
                backgroundImage: `url("${props.image}")`,
                backgroundSize: "contain", backgroundRepeat: "no-repeat",
                backgroundPositionX: "center",
                backgroundPositionY: "center",
                boxShadow: `0 0px calc(10px * ${Number(props.id === selectedTool)})`,
                backgroundColor: props.id === selectedTool ? theme.palette.secondary.main : undefined,
                outline: props.id === selectedTool ? `3px solid ${theme.palette.primary.main}` : undefined,
                outlineOffset: '1px',
                height:'48px', // >= 44px touch target
                marginTop: theme.spacing(1)
    }
} />
    }

type ToolGroupProps = {
    children: React.ReactNode
    type: string
    name?: string
}

const ToolGroup = (props: ToolGroupProps) =>
    <Stack alignItems="center" sx={{ marginY: theme.spacing(0.5), flexShrink: 0 }}>
        <Stack direction={isSmallScreen ? "row" : "column"} gap={isSmallScreen ? 1 : 0} alignItems="center">{props.children}</Stack>
        <Typography sx={{ textAlign: 'center', lineHeight:"1", marginTop: theme.spacing(0.5) }} variant="subtitle2">{t(`tools.${props.type}`)}{props.name}</Typography>
    </Stack>

const PutObstacleTool = () =>
    <ToolGroup type='putObstacle'>
        <Tool id="O" image={`${imagePathScene}/O.png`} label={t('tools.putObstacle')} />
    </ToolGroup>

const PutObjectTool = () =>
    <ToolGroup type='putObject'>
        {sceneObjectByType(challenge!.scene.type).validCells.map((object) =>
            <Tool id={object} key={object} image={`${imagePathScene}/${object}.png`}
                label={t('editor.board.putObjectNamed', { object: pieceName(t, challenge!.scene.type, object) })} />)}
    </ToolGroup>

const PutActorTool = () =>
    <ToolGroup type='putActor' name={t(`selection.cards.${challenge?.scene.type}.name`)!}>     
        <Tool id="A" image={`${imagePathScene}/tool.png`} label={`${t('tools.putActor')}${t(`selection.cards.${challenge?.scene.type}.name`)}`} />
    </ToolGroup>

const DeleteTool = () =>
    <ToolGroup type='delete'>
        <Tool id="-" image={`${imagePath}/eraser.png`} label={t('tools.delete')} />
    </ToolGroup>

// Small screens: one row above the board that scrolls sideways (the board keeps the whole width).
return (
    <PBCard sx={{ flexShrink: 0, minWidth: 0 }}>
        <Stack direction={isSmallScreen ? "row" : "column"} alignItems={isSmallScreen ? "flex-start" : "center"} justifyContent="flex-start" data-testid="scene-tools"
            gap={isSmallScreen ? 1 : 0}
            style={{ padding: theme.spacing(1), height: isSmallScreen ? undefined : "100%", width: "100%", overflowX: isSmallScreen ? "auto" : undefined }}
            role="group" aria-label={t('editor.board.tools')!}>
            <PutActorTool />
            <PutObstacleTool />
            <PutObjectTool />
            <DeleteTool />
        </Stack>
    </PBCard>
)
}


