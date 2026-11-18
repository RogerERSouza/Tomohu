import { AuthenticationScreen } from '../features/account/AuthenticationScreen'
import { LegacyNotebookPanel } from '../features/account/LegacyNotebookPanel'
import { PrivateItemsStatus } from '../features/privacy/PrivateItemsStatus'
import { useEffect, useRef, useState } from 'react'
import { AccountAction } from '../features/account/AccountAction'
import { readAccountLink } from '../features/account/accountLink'
import { AccountPanel } from '../features/account/AccountPanel'
import { useAccount } from '../features/account/useAccount'
import type { AccountController } from '../features/account/useAccount'
import { useAccountNotebook } from '../features/sync/useAccountNotebook'
import { SyncPanel } from '../features/sync/SyncPanel'
import { useExportCheckpoint } from '../features/backup/useExportCheckpoint'
import { LockedRouteGuard } from '../features/privacy/LockedRouteGuard'
import { privateCells } from '../features/privacy/PrivateCards'
import { usePrivacy } from '../features/privacy/usePrivacy'
import type { PrivacyController } from '../features/privacy/usePrivacy'
import { PrivacyPanel } from '../features/privacy/PrivacyPanel'
import { PrivacyDialog } from '../features/privacy/PrivacyDialog'
import { PrivateNotebookSession } from './PrivateNotebookSession'
import { PrivacyUnlockDialog } from '../features/privacy/PrivacyUnlockDialog'
import { publicPrivacyControls } from '../features/privacy/publicPrivacyControls'
import { createNotebookActions } from '../features/notebook/createNotebookActions'
import { NotebookView } from './NotebookView'

function ConnectedWorkspace({
  account,
  ownerId,
  remote,
  privacy,
}: {
  account: AccountController
  ownerId: string
  privacy: PrivacyController
  remote: NonNullable<AccountController['workspace']>['remote']
}) {
  const sync = useAccountNotebook(ownerId, remote, account.api, account.expire)
  const backup = useExportCheckpoint(sync.notebook)
  if (!account.session?.token)
    return (
      <AuthenticationScreen
        account={account}
        privateDraft={privacy.hasDraft}
        publicDraft={sync.dirty && Boolean(sync.storageError || sync.blocked)}
      />
    )
  if (privacy.opened)
    return (
      <PrivateNotebookSession
        key={privacy.opened.item.id}
        privacy={privacy}
        document={privacy.opened}
        publicBook={sync.notebook}
        operationBusy={account.busy || sync.busy}
        accountPanel={
          <>
            <PrivacyPanel
              privacy={privacy}
              authenticated={
                Boolean(account.session?.token) && !account.offline
              }
            />
            <AccountPanel
              account={account}
              notebook={sync.notebook}
              privateDraft={privacy.hasDraft}
            />
          </>
        }
      />
    )
  return (
    <>
      <LockedRouteGuard notebook={sync.notebook} privacy={privacy} />
      <NotebookView
        controller={sync}
        readOnly={account.offline}
        privateCells={(parentId) => privateCells(privacy, parentId)}
        privacy={
          account.session?.token
            ? publicPrivacyControls(
                sync.notebook,
                sync.revision,
                sync.dirty || sync.blocked || Boolean(sync.storageError),
                createNotebookActions(sync.setNotebook),
                privacy,
              )
            : undefined
        }
        onExport={backup.exportNotebook}
        interactionBlocked={sync.busy || account.busy || privacy.busy}
        status={
          <>
            {account.offline && (
              <p className="workspace-status" role="status">
                Sem conexão · somente leitura. Reconecte em Ajustes para editar;
                itens privados exigem conexão.
              </p>
            )}

            <PrivateItemsStatus privacy={privacy} />
            <p className="workspace-status" role="status">
              Caderno da conta ·{' '}
              {sync.dirty
                ? 'alterações locais pendentes'
                : 'última versão carregada'}
            </p>
          </>
        }
        accountPanel={
          <fieldset
            className="account-controls"
            disabled={sync.busy || privacy.busy}
          >
            <LegacyNotebookPanel
              onCopy={
                !privacy.hasDraft && !account.offline
                  ? account.create
                  : undefined
              }
              busy={account.busy}
            />
            <SyncPanel
              sync={sync}
              authenticated={
                Boolean(account.session?.token) && !account.offline
              }
              onExport={backup.exportNotebook}
            />
            <PrivacyPanel
              privacy={privacy}
              authenticated={
                Boolean(account.session?.token) && !account.offline
              }
            />
            <AccountPanel
              account={account}
              notebook={sync.notebook}
              privateDraft={privacy.hasDraft}
              canSwitch={
                !sync.storageError || !sync.dirty || backup.hasExported
              }
            />
          </fieldset>
        }
      />
    </>
  )
}
export default function App() {
  const account = useAccount()
  const privacy = usePrivacy(account)
  const [action, setAction] = useState(() =>
    readAccountLink(window.location.hash),
  )
  const previousRoute = useRef(action ? '' : window.location.hash)
  useEffect(() => {
    const changed = () => {
      const next = readAccountLink(window.location.hash)
      if (next) setAction(next)
      else previousRoute.current = window.location.hash
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  const workspace = account.workspace ? (
    <ConnectedWorkspace
      key={`${account.workspace.ownerId}:${account.workspace.remote.id}:${account.workspace.remote.revision}:${account.workspaceEpoch}`}
      account={account}
      privacy={privacy}
      ownerId={account.workspace.ownerId}
      remote={account.workspace.remote}
    />
  ) : (
    <AuthenticationScreen account={account} privateDraft={privacy.hasDraft} />
  )
  return (
    <>
      {action && (
        <AccountAction
          key={`${action.purpose}:${action.token}`}
          action={action}
          onReset={account.expire}
          onPrivacyReset={privacy.lock}
          onClose={() => {
            setAction(null)
            window.location.hash = previousRoute.current
            window.dispatchEvent(new HashChangeEvent('hashchange'))
          }}
        />
      )}
      <div hidden={Boolean(action)}>{workspace}</div>
      {!action && privacy.prompt && <PrivacyUnlockDialog privacy={privacy} />}
      {!action && privacy.area && <PrivacyDialog privacy={privacy} />}
    </>
  )
}
