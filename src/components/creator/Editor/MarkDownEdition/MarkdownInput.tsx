import { Switch, FormControlLabel, TextField, Collapse } from "@mui/material";
import { useTranslation } from "react-i18next";
import { MutableRefObject } from "react";

type MarkdownInputProps = {
  statement: string,
  setStatement: (statement: string) => void,
  clue: string | undefined,
  setClue: (clue?: string) => void
  statementButtonRef: MutableRefObject<HTMLButtonElement | null>
  clueButtonRef: MutableRefObject<HTMLButtonElement | null>
}

/**
 * Statement (Markdown) and optional clue inputs. The clue lives in a collapsible field
 * that opens with the switch; turning it off removes the clue.
 */
export const MarkdownInput = (props: MarkdownInputProps) => {

  const { t } = useTranslation('creator');

  const clueIsEnabled = props.clue !== undefined

  const toggleClueEnabled = (e: { currentTarget: { checked: boolean }; }) => {
    if (!e.currentTarget.checked) {
      props.setClue(undefined)
      props.statementButtonRef.current?.click()
    } else {
      props.setClue(t("statement.defaultClue")!)
    }
  }

  return (
    <>
      <TextField
        fullWidth
        size="small"
        multiline={true}
        minRows={3}
        inputProps={{ "data-testid": "statement-input" }}
        label={t('statement.description')}
        helperText={t('statement.markdownHelp')}
        value={props.statement}
        onChange={e => props.setStatement(e.currentTarget.value)}
        onFocus={() => props.statementButtonRef.current?.click()}
        sx={{ marginTop: '10px' }}
        id="statement-input"
      />
      <FormControlLabel
        control={<Switch color="primary" onChange={toggleClueEnabled} checked={clueIsEnabled}
          inputProps={{ 'aria-expanded': clueIsEnabled, 'aria-controls': 'clue-input-container' } as any}
          data-testid="clue-switch" />}
        label={t("statement.clueToggle")} />
      <Collapse in={clueIsEnabled} id="clue-input-container" unmountOnExit>
        <TextField
          fullWidth
          size="small"
          multiline={true}
          label={t('statement.clue')}
          value={props.clue || ''}
          onChange={e => props.setClue(e.currentTarget.value)}
          onFocus={() => props.clueButtonRef.current?.click()}
          inputProps={{ "data-testid": "clue-input" }}
          id="clue-input"
        />
      </Collapse>
    </>
  );
}
