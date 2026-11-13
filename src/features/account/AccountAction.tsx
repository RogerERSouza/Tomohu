import { Modal } from '../../components/Modal'
import type { AccountLink } from './accountLink'
import { useEffect, useState } from 'react'
import {
  ApiError,
  apiErrorMessage,
  createApiClient,
} from '../../lib/api/client'
import { passwordHint, validNewPassword } from './passwordPolicy'

export function AccountAction({
  action,
  onClose,
  onReset,
  onPrivacyReset,
}: {
  action: AccountLink
  onClose: () => void
  onReset: () => void
  onPrivacyReset?: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )
  }, [])
  return (
    <Modal
      title={
        done
          ? action.purpose === 'verify'
            ? 'E-mail confirmado'
            : action.purpose === 'private'
              ? 'Senha de privacidade redefinida'
              : 'Senha redefinida'
          : action.purpose === 'verify'
            ? 'Confirmar e-mail'
            : action.purpose === 'private'
              ? 'Nova senha de privacidade'
              : 'Criar nova senha'
      }
      closeOnBackdrop={false}
      closeDisabled={busy}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <div className="modal-form">
        {!done && (
          <p>
            Abrir este link não altera sua conta. Confirme abaixo para
            continuar.
          </p>
        )}
        {done ? (
          <p role="status">
            {action.purpose === 'verify'
              ? 'E-mail confirmado.'
              : action.purpose === 'private'
                ? 'Senha de privacidade redefinida. Desbloqueie novamente com a nova senha.'
                : 'Senha redefinida e sessões encerradas. Entre com a nova senha.'}{' '}
            Seus cadernos foram preservados.
          </p>
        ) : (
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (busy) return
              if (
                action.purpose !== 'verify' &&
                (!validNewPassword(password) || password !== confirmation)
              ) {
                setError(
                  password !== confirmation
                    ? 'As senhas não coincidem.'
                    : passwordHint,
                )
                return
              }
              const secret = password
              setPassword('')
              setConfirmation('')
              setBusy(true)
              setError('')
              void (async () => {
                try {
                  const api = createApiClient(
                    import.meta.env.VITE_API_BASE_URL ?? '',
                  )
                  if (action.purpose === 'verify')
                    await api.verifyEmail(action.token)
                  else if (action.purpose === 'private') {
                    await api.privacyReset(action.token, secret)
                    onPrivacyReset?.()
                  } else {
                    await api.resetPassword(action.token, secret)
                    onReset()
                  }
                  setDone(true)
                } catch (error) {
                  setError(
                    error instanceof ApiError &&
                      [400, 422].includes(error.status)
                      ? 'Não foi possível concluir: link inválido, expirado ou já utilizado. Solicite um novo link na conta.'
                      : apiErrorMessage(error),
                  )
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            {action.purpose !== 'verify' && (
              <>
                <p className="muted">{passwordHint}</p>
                <label className="field">
                  Nova senha
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={5}
                    maxLength={128}
                    disabled={busy}
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
                    disabled={busy}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
              </>
            )}
            <button className="primary-button" disabled={busy}>
              {busy
                ? 'Aguarde…'
                : action.purpose === 'verify'
                  ? 'Confirmar meu e-mail'
                  : 'Redefinir senha'}
            </button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onClose}
        >
          Voltar ao caderno
        </button>
      </div>
    </Modal>
  )
}
