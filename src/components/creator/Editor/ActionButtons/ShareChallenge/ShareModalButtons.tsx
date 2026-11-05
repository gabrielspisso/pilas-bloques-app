import LinkIcon from '@mui/icons-material/Link';
import SaveIcon from '@mui/icons-material/Save';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { ReactNode, useContext, useState } from "react"
import { IconButtonTooltip } from "../../SceneEdition/IconButtonTooltip"
import { Snackbar, Stack, Tooltip } from "@mui/material"
import { CreatorContext } from '../../CreatorContext';
import { LocalStorage } from '../../../../../localStorage';
import { PilasBloquesApi } from '../../../../../pbApi';
import { CreatorActionButton } from '../CreatorActionButton';
import { DialogSnackbar } from '../../../../dialogSnackbar/DialogSnackbar';
import { useTranslation } from 'react-i18next';
import { SerializedChallenge } from '../../../../serializedChallenge';
import { DownloadButton } from '../DownloadButton';
import ReactGA from "react-ga4";
import { PublishChecklist, usePublishChecklist } from './PublishChecklist';

export const CopyToClipboardButton = ({ textToCopy }: { textToCopy: string }) => {

    const [openSnackbar, setOpenSnackbar] = useState(false)

    const { t } = useTranslation('creator');

    const handleClick = () => {
        setOpenSnackbar(true)
        navigator.clipboard.writeText(textToCopy)
    }

    return <>
        <IconButtonTooltip icon={<ContentCopyIcon />} onClick={handleClick} tooltip={t('editor.buttons.copyToClipboard')} />
        <Snackbar
            open={openSnackbar}
            onClose={() => setOpenSnackbar(false)}
            autoHideDuration={2000}
            message={t('editor.buttons.copiedToClipboard')}
        />
    </>
}

export const ShareButtons = () => {
    const { sharedId } = useContext(CreatorContext)
    const { items, disabledReason } = usePublishChecklist()

    return <>
        <PublishChecklist items={items} disabledReason={disabledReason} />
        <Stack direction="row" justifyContent="space-between" alignItems='center'>
            {// If the challenge has already been saved, show Save, else show Share, which saves for the first time.
                sharedId ? <SaveButton disabledReason={disabledReason} /> : <ShareUrlButton disabledReason={disabledReason} />
            }
            <DownloadButton />
        </Stack>
    </>
}

const ShareUrlButton = ({ disabledReason }: { disabledReason: string }) => 
    <ChallengeUpsertButton Icon={<LinkIcon />} nametag="shareUrl" challengeUpsert={PilasBloquesApi.shareChallenge} disabledReason={disabledReason} />

const SaveButton = ({ disabledReason }: { disabledReason: string }) => 
    <ChallengeUpsertButton Icon={<SaveIcon />} nametag="save" challengeUpsert={PilasBloquesApi.saveChallenge} disabledReason={disabledReason} />

/** disabledReason: why the challenge can't be published yet (empty when it can). */
export const ChallengeUpsertButton = ({ Icon, challengeUpsert, nametag, disabledReason = '' }: { Icon: ReactNode, nametag: string, challengeUpsert: (challenge: SerializedChallenge) => Promise<SerializedChallenge>, disabledReason?: string }) => {

    const { setSharedId } = useContext(CreatorContext)
    const userLoggedIn = !!LocalStorage.getUser()
    const [serverError, setServerError] = useState<boolean>(false)
    const { t } = useTranslation('creator');
    const [savedSnackbar, setSavedSnackbarOpen] = useState(false)

    const handleClick = async () => {
        try {
            const savedChallenge = await challengeUpsert(LocalStorage.getCreatorChallenge()!)
            setSharedId(savedChallenge.sharedId!)
            setSavedSnackbarOpen(true)

            ReactGA.event({
                category: "creator",
                action: nametag === 'save' ? "update_shared_challenge" : "share_new_challenge"
            });
        }
        catch (error) {
            setServerError(true)
        }
    }

    return <>
        <Snackbar
            open={savedSnackbar}
            onClose={() => setSavedSnackbarOpen(false)}
            autoHideDuration={2000}
            message={t('editor.buttons.savedCorrectly')}
        />
        <Tooltip title={[!userLoggedIn ? t('editor.loginWarning') : '', disabledReason].filter(Boolean).join(' ')} followCursor>
            <div>
                <CreatorActionButton data-testid="upsertButton" onClick={handleClick} disabled={!userLoggedIn || !!disabledReason} startIcon={Icon} variant='contained' nametag={nametag} />
            </div>
        </Tooltip>
        <DialogSnackbar open={serverError} onClose={() => setServerError(false)} message={t('editor.serverError')} />
    </>
}