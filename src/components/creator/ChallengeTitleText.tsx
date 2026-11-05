import { Typography } from "@mui/material"

/**
 * A creator challenge title inside a header: titles can be up to 80 characters,
 * so it stays on one line and ends with an ellipsis instead of pushing the header controls away.
 */
export const ChallengeTitleText = ({ title }: { title?: string }) =>
    <Typography noWrap title={title} data-testid="header-challenge-title"
        sx={{ display: 'block', minWidth: 0, maxWidth: 'min(40vw, 480px)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
    </Typography>
