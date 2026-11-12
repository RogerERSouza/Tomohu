import { AccountSecurity } from './AccountSecurity'
import { CredentialsForm } from './CredentialsForm'
import { useState } from 'react'
import type { AccountController } from './useAccount'
import type { Notebook } from '../../types'

const emptyNotebook: Notebook = {
  schemaVersion: 1,
  sections: [],
  contents: [],
  reminders: [],
}
export function AccountPanel({
  account,
  notebook,
  canSwitch = true,
}: {
  account: AccountController
  notebook: Notebook
  canSwitch?: boolean
}) {
  const [confirmation, setConfirmation] = useState(false)
  const [selected, setSelected] = useState('')
  if (!account.enabled)
    return (
      <p className="muted">
        Contas indisponíveis nesta instalação. Seus dados continuam neste
        navegador.
      </p>
    )
  return (
    <section aria-label="Conta e cadernos" className="account-panel">
      <h3>Conta e cadernos</h3>
      {!canSwitch && (
        <p role="alert">
          Exporte a cópia aberta antes de sair ou trocar de caderno: o
          armazenamento local está indisponível.
        </p>
      )}
      {account.session?.token ? (
        <>
          <p>
            Conectado como <strong>{account.session.user.email}</strong>.
          </p>
          <AccountSecurity account={account} />
          <p className="muted">
            Abra um caderno ou crie outro. O caderno local não é enviado
            automaticamente.
          </p>
          <button
            type="button"
            className="text-button"
            disabled={account.busy}
            onClick={() => void account.refresh()}
          >
            Atualizar lista de cadernos
          </button>
          <label className="field">
            Caderno da conta
            <select
              aria-label="Caderno da conta"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={account.busy || !canSwitch}
            >
              <option value="">Escolher caderno</option>
              {account.items.map((item, index) => (
                <option key={item.id} value={item.id}>
                  Caderno {index + 1}
                  {item.title ? ` — ${item.title}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={!selected || account.busy || !canSwitch}
            onClick={() => void account.open(selected)}
          >
            Abrir caderno da conta
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={account.busy || !canSwitch}
            onClick={() => void account.create(emptyNotebook)}
          >
            Criar caderno vazio
          </button>
          <label className="account-confirm">
            <input
              type="checkbox"
              checked={confirmation}
              onChange={(event) => setConfirmation(event.target.checked)}
              disabled={account.busy || !canSwitch}
            />
            Confirmo enviar uma cópia do caderno aberto para esta conta, sem
            apagar o original.
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={!confirmation || account.busy || !canSwitch}
            onClick={() => {
              setConfirmation(false)
              void account.create(notebook)
            }}
          >
            Enviar cópia como novo caderno
          </button>
        </>
      ) : (
        <CredentialsForm
          busy={account.busy}
          canSwitch={canSwitch}
          expired={Boolean(account.session)}
          onAuthenticate={account.authenticate}
          onRequestReset={account.requestReset}
        />
      )}
      {account.session && account.notice && (
        <p role="status">{account.notice}</p>
      )}
      {account.error && (
        <p role="alert" className="form-warning">
          {account.error}
        </p>
      )}
      {account.busy && <p role="status">Acessando conta…</p>}
      {account.session && (
        <button
          type="button"
          className="secondary-button"
          disabled={account.busy || !canSwitch}
          onClick={account.logout}
        >
          Sair e voltar ao caderno local
        </button>
      )}
    </section>
  )
}
