import { useEffect, useRef, useState } from 'react'
import { AccountAction } from '../features/account/AccountAction'
import { readAccountLink } from '../features/account/accountLink'
import { AccountPanel } from '../features/account/AccountPanel'
import { useAccount } from '../features/account/useAccount'
import type { AccountController } from '../features/account/useAccount'
import { useNotebook } from '../features/notebook/useNotebook'
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

function GuestWorkspace({
  account,
  privacy,
}: {
  account: AccountController
  privacy: PrivacyController
}) {
  const controller = useNotebook()
  const backup = useExportCheckpoint(controller.notebook)
  return (
    <NotebookView
      controller={controller}
      status={
        !account.session && account.notice ? (
          <p className="workspace-status" role="status">
            {account.notice}
          </p>
        ) : undefined
      }
      onExport={backup.exportNotebook}
      accountPanel={
        <fieldset className="account-controls" disabled={privacy.busy}>
          <AccountPanel
            account={account}
            notebook={controller.notebook}
            canSwitch={!controller.storageError || backup.hasExported}
          />
          <PrivacyPanel
            privacy={privacy}
            authenticated={Boolean(account.session?.token)}
          />
        </fieldset>
      }
      interactionBlocked={account.busy || privacy.busy}
    />
  )
}
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
  if (privacy.opened)
    return (
      <PrivateNotebookSession
        key={privacy.opened.item.id}
        privacy={privacy}
        document={privacy.opened}
        publicBook={sync.notebook}
        accountPanel={
          <>
            <PrivacyPanel
              privacy={privacy}
              authenticated={Boolean(account.session?.token)}
            />
            <AccountPanel
              account={account}
              notebook={sync.notebook}
              canSwitch={!privacy.hasDraft}
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
          <p className="workspace-status" role="status">
            Caderno da conta ·{' '}
            {sync.dirty
              ? 'alterações locais pendentes'
              : 'última versão carregada'}
            {!account.session?.token ? ' · sessão encerrada' : ''}
          </p>
        }
        accountPanel={
          <fieldset
            className="account-controls"
            disabled={sync.busy || privacy.busy}
          >
            <SyncPanel
              sync={sync}
              authenticated={Boolean(account.session?.token)}
              onExport={backup.exportNotebook}
            />
            <PrivacyPanel
              privacy={privacy}
              authenticated={Boolean(account.session?.token)}
            />
            <AccountPanel
              account={account}
              notebook={sync.notebook}
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
      key={`${account.workspace.ownerId}:${account.workspace.remote.id}:${account.workspace.remote.revision}`}
      account={account}
      privacy={privacy}
      ownerId={account.workspace.ownerId}
      remote={account.workspace.remote}
    />
  ) : (
    <GuestWorkspace account={account} privacy={privacy} />
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
