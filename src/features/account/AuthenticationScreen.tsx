import { AccountPanel } from './AccountPanel'
import { LegacyNotebookPanel } from './LegacyNotebookPanel'
import type { AccountController } from './useAccount'

export function AuthenticationScreen({
  account,
  privateDraft = false,
  publicDraft = false,
}: {
  account: AccountController
  privateDraft?: boolean
  publicDraft?: boolean
}) {
  return (
    <main className="auth-shell">
      <h1>Tomohu</h1>
      <p>Entre na sua conta ou cadastre-se para acessar seus cadernos.</p>
      {account.starting ? (
        <p role="status">Verificando sua sessão…</p>
      ) : account.enabled ? (
        <AccountPanel
          account={account}
          privateDraft={privateDraft}
          publicDraft={publicDraft}
          notebook={{
            schemaVersion: 1,
            sections: [],
            contents: [],
            reminders: [],
          }}
        />
      ) : (
        <p role="alert">
          A conexão com o serviço de contas não está configurada nesta
          instalação. Seus dados anteriores foram preservados.
        </p>
      )}
      {!account.session && account.notice && (
        <p role="status">{account.notice}</p>
      )}
      {!account.starting && account.enabled && (
        <button
          className="text-button"
          disabled={account.busy}
          onClick={() => void account.resume()}
        >
          Tentar reconectar
        </button>
      )}
      <LegacyNotebookPanel />
    </main>
  )
}
