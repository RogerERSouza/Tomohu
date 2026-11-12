import { useState } from 'react'
import type { AccountSession } from '../../lib/api/client'
import { ApiError, apiErrorMessage } from '../../lib/api/client'
import type { AccountController } from './useAccount'
import { passwordHint, validNewPassword } from './passwordPolicy'

export function AccountSecurity({ account }: { account: AccountController }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState<AccountSession[]>([])
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const verified = account.session?.user.emailVerified === true
  const [show, setShow] = useState(false)
  async function run(action: () => Promise<void>) {
    if (busy || account.busy) return
    await account.perform(async () => {
      setBusy(true)
      setError('')
      account.setNotice('')
      try {
        await action()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          account.setNotice(apiErrorMessage(error))
          account.expire()
        }
        setError(
          error instanceof ApiError && error.status === 400
            ? 'Confira a senha atual e tente novamente.'
            : apiErrorMessage(error),
        )
      } finally {
        setBusy(false)
      }
    })
  }
  const api = account.api
  if (!api) return null
  return (
    <section aria-label="Segurança da conta">
      <button
        type="button"
        className="text-button"
        disabled={busy || account.busy}
        onClick={() => setShow(!show)}
      >
        Segurança da conta
      </button>
      {show && (
        <fieldset className="account-controls" disabled={busy || account.busy}>
          <p>E-mail {verified ? 'verificado' : 'ainda não verificado'}.</p>
          {!verified && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void run(async () => {
                  await api.requestVerification()
                  account.setNotice(
                    'Se necessário, enviaremos um novo link de confirmação. Ele expira em 30 minutos.',
                  )
                })
              }
            >
              Reenviar confirmação de e-mail
            </button>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setError('')
              account.setNotice('')
              void account.refreshUser()
            }}
          >
            Atualizar confirmação
          </button>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!validNewPassword(password) || password !== confirmation) {
                setError(
                  password !== confirmation
                    ? 'As senhas não coincidem.'
                    : passwordHint,
                )
                return
              }
              const old = current
              const next = password
              setCurrent('')
              setPassword('')
              setConfirmation('')
              void run(async () => {
                await api.changePassword(old, next)
                account.setNotice(
                  'Senha alterada. Todas as sessões foram encerradas; entre novamente. A cópia local foi preservada.',
                )
                account.expire()
              })
            }}
          >
            <h4>Alterar senha</h4>
            <p className="muted">
              {passwordHint} Alterar a senha encerra todas as sessões, sem
              apagar os cadernos.
            </p>
            <label className="field">
              Senha atual
              <input
                required
                type="password"
                autoComplete="current-password"
                maxLength={128}
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </label>
            <label className="field">
              Nova senha
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={5}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="field">
              Confirmar nova senha
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={5}
                maxLength={128}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <button className="secondary-button">
              Alterar senha e encerrar sessões
            </button>
          </form>
          <h4>Sessões ativas</h4>
          <p className="muted">
            Sessões duram até 15 minutos por padrão. Encerrar uma sessão
            bloqueia sua próxima requisição; cópias já baixadas continuam no
            dispositivo.
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void run(async () => setSessions(await api.sessions()))
            }
          >
            Atualizar sessões
          </button>
          {sessions.map((item) => (
            <div key={item.id}>
              <p>
                {item.current ? 'Esta sessão' : 'Outra sessão'} ·{' '}
                {new Date(item.created_at).toLocaleString()} · expira{' '}
                {new Date(item.expires_at).toLocaleTimeString()}
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  void run(async () => {
                    await api.revokeSession(item.id)
                    if (item.current) {
                      account.setNotice(
                        'Sessão encerrada. Suas alterações locais foram preservadas.',
                      )
                      account.expire()
                    } else setSessions(await api.sessions())
                  })
                }
              >
                Encerrar {item.current ? 'esta sessão' : 'sessão'}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void run(async () => {
                await api.revokeAllSessions()
                account.setNotice(
                  'Todas as sessões foram encerradas. Entre novamente para sincronizar.',
                )
                account.expire()
              })
            }
          >
            Encerrar todas as sessões
          </button>
        </fieldset>
      )}
      {busy && <p role="status">Atualizando segurança…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
