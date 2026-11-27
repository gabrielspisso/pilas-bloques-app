import { Button, ButtonProps, darken, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "../../../../theme/ThemeContext";

/** Icon-only action buttons on small screens: a 44 px target with 2 px side margins. */
export const COMPACT_ACTION_BUTTON_PX = 44
export const COMPACT_ACTION_MARGIN_PX = 2

type CreatorActionButtonProps = {
  nametag: string,
  isshortversion?: boolean
  /** On small screens show only the icon (the full label stays as tooltip and accessible name). */
  iconOnlyOnSmallScreen?: boolean
} & ButtonProps

export const CreatorActionButton = ({ isshortversion = false, iconOnlyOnSmallScreen = false, ...props }: CreatorActionButtonProps) => {
  const { isSmallScreen } = useThemeContext()

  const { t } = useTranslation('creator')

  const iconOnly = iconOnlyOnSmallScreen && isSmallScreen && !!props.startIcon

  if (iconOnly) {
    const { startIcon, sx, ...rest } = props
    return <Tooltip title={t(`editor.buttons.${props.nametag}`)}>
      <Button {...rest} variant="outlined" aria-label={t(`editor.buttons.${props.nametag}`)!}
        sx={{
          ...sx,
          minWidth: COMPACT_ACTION_BUTTON_PX, width: COMPACT_ACTION_BUTTON_PX, height: COMPACT_ACTION_BUTTON_PX,
          padding: 0, margin: `0 ${COMPACT_ACTION_MARGIN_PX}px`, flexShrink: 0
        }}>
        {startIcon}
      </Button>
    </Tooltip>
  }

  return (
    <Tooltip title={isSmallScreen ? t(`editor.buttons.${props.nametag}`) : ''}>
      <Button {...props} variant="outlined" 
        sx={{ textTransform: "none",
              margin: '0 10px',
              whiteSpace: 'nowrap',
              ...props.sx
            }}>
        {t(`editor.buttons.${props.nametag}${!isshortversion && isSmallScreen ? 'Short' : ''}`)}
      </Button >
    </Tooltip>
  )
}

export const StyledCreatorActionButton = (props: CreatorActionButtonProps) => {
  const backgroundColor = '#ffb600'

  return <CreatorActionButton
    sx={{
      height: 45,
      fontSize: 18,
      color: 'white',
      fontWeight: 'bold',
      border: 0,
      backgroundColor: backgroundColor,
      '&:hover': {
        backgroundColor: darken(backgroundColor, 0.2),
        border: 0,
      },
      ...props.sx
    }}
    {...props}>
    {props.children}
  </CreatorActionButton>
}
