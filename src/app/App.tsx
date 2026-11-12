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
import { NotebookView } from './NotebookView'

function GuestWorkspace({ account }: { account: AccountController }) {
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
        <AccountPanel
          account={account}
          notebook={controller.notebook}
          canSwitch={!controller.storageError || backup.hasExported}
        />
      }
      interactionBlocked={account.busy}
    />
  )
}
function ConnectedWorkspace({
  account,
  ownerId,
  remote,
}: {
  account: AccountController
  ownerId: string
  remote: NonNullable<AccountController['workspace']>['remote']
}) {
  const sync = useAccountNotebook(ownerId, remote, account.api, account.expire)
  const backup = useExportCheckpoint(sync.notebook)
  return (
    <NotebookView
      controller={sync}
      onExport={backup.exportNotebook}
      interactionBlocked={sync.busy || account.busy}
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
        <fieldset className="account-controls" disabled={sync.busy}>
          <SyncPanel
            sync={sync}
            authenticated={Boolean(account.session?.token)}
            onExport={backup.exportNotebook}
          />
          <AccountPanel
            account={account}
            notebook={sync.notebook}
            canSwitch={!sync.storageError || !sync.dirty || backup.hasExported}
          />
        </fieldset>
      }
    />
  )
}
export default function App() {
  const account = useAccount()
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
      ownerId={account.workspace.ownerId}
      remote={account.workspace.remote}
    />
  ) : (
    <GuestWorkspace account={account} />
  )
  return (
    <>
      {action && (
        <AccountAction
          key={`${action.purpose}:${action.token}`}
          action={action}
          onReset={account.expire}
          onClose={() => {
            setAction(null)
            window.location.hash = previousRoute.current
            window.dispatchEvent(new HashChangeEvent('hashchange'))
          }}
        />
      )}
      <div hidden={Boolean(action)}>{workspace}</div>
    </>
  )
}
