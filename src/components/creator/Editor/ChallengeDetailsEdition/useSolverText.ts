import { useTranslation } from "react-i18next"
import { AssessmentWarning } from "../../solver/types"
import { useBlockName } from "./SolutionProgramView"

/** The translated texts about the solver, shared by its dialog and by the proposals of the assistant. */
export const useSolverText = () => {
    const { t } = useTranslation(['creator', 'blocks'])
    const blockName = useBlockName()

    /** Interpolated values are plain text (React already escapes them). */
    const text = (key: string, values: object = {}): string =>
        t(`solver.${key}`, { ...values, interpolation: { escapeValue: false } }) as string

    const blockNames = (blocks: string[] = []) => blocks.map(blockName).join(', ')

    const warningText = (warning: AssessmentWarning) => {
        if (warning.id === 'decompositionMissingBlock') return text('reasons.decompositionMissingBlock')
        const message = text(`warnings.${warning.id}`, { ...warning, name: 'name' in warning ? warning.name ?? text('mainName') : '' })
        if (!('reason' in warning)) return message
        return `${message} ${text(`reasons.${warning.reason}`, { blocks: blockNames('blocks' in warning ? warning.blocks : []) })}`
    }

    return { text, blockName, blockNames, warningText }
}
