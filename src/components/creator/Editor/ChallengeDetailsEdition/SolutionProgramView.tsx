import { Box, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"
import { getBlockFromId } from "../../../blockly/blocks"
import { MOVE_TO_PREFIX } from "../../solver/grid"
import { Program, Statement } from "../../solver/types"

/** The translated text of a block, as the toolbox shows it. */
export const useBlockName = () => {
    const { t } = useTranslation(['creator', 'blocks'])
    return (id: string): string => {
        const block = getBlockFromId(id)
        return block ? t(`blocks.${block.intlId}`, { ns: 'blocks' }) : id
    }
}

/**
 * The program as a nested text list. A second Blockly workspace is deliberately avoided:
 * it would replace the main workspace the live preview uses.
 */
export const SolutionProgramView = ({ program }: { program: Program }) => {
    const { t } = useTranslation(['creator', 'blocks'])
    const blockName = useBlockName()
    const plain = { interpolation: { escapeValue: false } }

    const actionText = (token: string) => token.startsWith(MOVE_TO_PREFIX)
        ? `${blockName('MoverA')} ${blockName(token.slice(MOVE_TO_PREFIX.length))}`
        : blockName(token)

    const list = (statements: Statement[]) =>
        <Box component="ul" sx={{ margin: 0, paddingLeft: 3 }}>
            {statements.map((statement, i) => <li key={i}>{item(statement)}</li>)}
        </Box>

    const item = (statement: Statement) => {
        switch (statement.kind) {
            case 'action': return actionText(statement.block)
            case 'call': return statement.name
            case 'repeat': return <>{t('solver.repeat', { times: statement.times })}{list(statement.body)}</>
        }
    }

    const declaration = (title: string, body: Statement[], key: string) =>
        <Box key={key} sx={{ marginTop: 1 }}>
            <Typography variant="body2" fontWeight="bold">{title}</Typography>
            <Typography variant="body2" component="div">{list(body)}</Typography>
        </Box>

    return <Box data-testid="solution-program">
        {declaration(t('blocks.program', { ns: 'blocks' }), program.main, 'main')}
        {program.procedures.map(({ name, body }) => declaration(t('solver.definition', { name, ...plain }), body, `procedure-${name}`))}
    </Box>
}
